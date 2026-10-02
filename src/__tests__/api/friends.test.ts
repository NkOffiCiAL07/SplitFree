import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET, POST, DELETE } from "@/app/api/friends/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const get = (qs = "") => GET(new NextRequest(`http://x/api/friends${qs}`));
const send = (method: string, body: unknown) => (method === "POST" ? POST : DELETE)(new NextRequest("http://x/api/friends", { method, body: JSON.stringify(body) }));

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.upsert.mockResolvedValue({});
  p.notification.createMany.mockResolvedValue({});
});

describe("GET /api/friends", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await get()).status).toBe(401);
  });

  it("lists my accepted friends", async () => {
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
    await get();
    expect(p.friendship.findMany.mock.calls[0][0].where).toEqual({ userId: ME, status: "ACCEPTED" });
  });

  it("?pending=true lists incoming requests only", async () => {
    p.friendship.findMany.mockResolvedValue([]);
    await get("?pending=true");
    expect(p.friendship.findMany.mock.calls[0][0].where).toEqual({ friendId: ME, status: "PENDING" });
  });

  it("?sent=true lists outgoing requests only", async () => {
    p.friendship.findMany.mockResolvedValue([]);
    await get("?sent=true");
    expect(p.friendship.findMany.mock.calls[0][0].where).toEqual({ userId: ME, status: "PENDING" });
  });

  it("?contacts=true adds people from shared groups who aren't friends yet (marked fromGroup)", async () => {
    p.friendship.findMany.mockResolvedValue([{ id: "f1", friendId: OTHER, friend: { name: "Asha" } }]);
    p.groupMember.findMany.mockResolvedValue([{ userId: "g-mate", joinedAt: new Date(), user: { id: "g-mate", name: "Bhanu" } }]);
    const { data } = await (await get("?contacts=true")).json();
    expect(data).toHaveLength(2);
    expect(data[1]).toMatchObject({ friendId: "g-mate", fromGroup: true });
    // existing friends and yourself are excluded from the group-mate lookup
    expect(p.groupMember.findMany.mock.calls[0][0].where.userId).toEqual({ notIn: [ME, OTHER] });
  });
});

describe("POST /api/friends — send a request", () => {
  it("rejects bad emails, yourself and unknown users", async () => {
    expect((await send("POST", { email: "nope" })).status).toBe(422);
    expect((await send("POST", { email: "me@example.com" })).status).toBe(400);
    p.user.findUnique.mockResolvedValue(null);
    const res = await send("POST", { email: "ghost@x.com" });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toMatch(/sign up first/i);
  });

  it("won't send a duplicate request or re-add an existing friend", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER });
    p.friendship.findUnique.mockResolvedValue({ status: "PENDING" });
    const dup = await send("POST", { email: "a@x.com" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.message).toMatch(/already sent/i);
    p.friendship.findUnique.mockResolvedValue({ status: "ACCEPTED" });
    expect((await (await send("POST", { email: "a@x.com" })).json()).error.message).toMatch(/already friends/i);
    expect(p.friendship.create).not.toHaveBeenCalled();
  });

  it("creates a PENDING request and notifies the other person", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER });
    p.friendship.findUnique.mockResolvedValue(null);
    p.friendship.create.mockResolvedValue({ id: "f1" });
    expect((await send("POST", { email: "a@x.com" })).status).toBe(201);
    expect(p.friendship.create.mock.calls[0][0].data).toEqual({ userId: ME, friendId: OTHER, status: "PENDING" });
    const note = p.notification.createMany.mock.calls[0][0].data[0];
    expect(note).toMatchObject({ userId: OTHER, type: "FRIEND_ADDED", title: "New friend request" });
    expect(note.data).toMatchObject({ userId: ME, pending: true });
  });
});

describe("POST /api/friends — accept / decline", () => {
  beforeEach(() => {
    p.notification.findMany.mockResolvedValue([{ id: "n1", data: { userId: OTHER, pending: true } }, { id: "n2", data: { userId: "someone-else", pending: true } }]);
    p.notification.updateMany.mockResolvedValue({});
  });

  it("accepting makes the friendship mutual and notifies the requester", async () => {
    p.friendship.update.mockResolvedValue({});
    p.friendship.upsert.mockResolvedValue({});
    const res = await send("POST", { action: "accept", requesterId: OTHER });
    expect(res.status).toBe(200);
    expect(p.friendship.update.mock.calls[0][0]).toMatchObject({ where: { userId_friendId: { userId: OTHER, friendId: ME } }, data: { status: "ACCEPTED" } });
    expect(p.friendship.upsert.mock.calls[0][0].create).toEqual({ userId: ME, friendId: OTHER, status: "ACCEPTED" });
    expect(p.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: OTHER, title: "Friend request accepted" });
  });

  it("clears only the matching pending notification (not other people's)", async () => {
    p.friendship.update.mockResolvedValue({});
    p.friendship.upsert.mockResolvedValue({});
    await send("POST", { action: "accept", requesterId: OTHER });
    expect(p.notification.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ["n1"] } });
  });

  it("declining deletes the request and doesn't create a friendship", async () => {
    p.friendship.deleteMany.mockResolvedValue({});
    const res = await send("POST", { action: "decline", requesterId: OTHER });
    expect((await res.json()).data).toEqual({ declined: true });
    expect(p.friendship.deleteMany.mock.calls[0][0].where).toEqual({ userId: OTHER, friendId: ME });
    expect(p.friendship.upsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/friends", () => {
  it("removes the friendship in both directions", async () => {
    p.friendship.deleteMany.mockResolvedValue({});
    expect((await send("DELETE", { friendId: OTHER })).status).toBe(200);
    expect(p.friendship.deleteMany.mock.calls[0][0].where).toEqual({ OR: [{ userId: ME, friendId: OTHER }, { userId: OTHER, friendId: ME }] });
  });
});
