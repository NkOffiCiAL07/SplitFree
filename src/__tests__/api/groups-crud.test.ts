import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";
import { resetRateLimits } from "@/lib/api-helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return {
    createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }),
    createAdminClient: async () => ({ auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({}) } } }),
  };
});

import { POST as CREATE_GROUP } from "@/app/api/groups/route";
import { PATCH as EDIT_GROUP, DELETE as DELETE_GROUP } from "@/app/api/groups/[id]/route";
import { PATCH as CHANGE_ROLE, POST as ADD_MEMBER } from "@/app/api/groups/[id]/members/route";
import { GET as GET_INVITE, DELETE as REVOKE_INVITE } from "@/app/api/groups/[id]/invite-link/route";
import { GET as PREVIEW_JOIN, POST as JOIN } from "@/app/api/join/[token]/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({ id: GROUP }) };
const json = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://x/api", { method, body: JSON.stringify(body), headers });

beforeEach(() => {
  resetPrisma();
  resetRateLimits();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.upsert.mockResolvedValue({});
  p.user.findUnique.mockResolvedValue({ id: ME });
  p.activity.create.mockResolvedValue({});
});

describe("POST /api/groups (create)", () => {
  const valid = { name: "Goa Trip", category: "TRIP", currency: "INR" };

  it("requires sign-in", async () => {
    authState.user = null;
    expect((await CREATE_GROUP(json("POST", valid))).status).toBe(401);
  });

  it("validates the body (name, category, currency, emails)", async () => {
    for (const bad of [
      { ...valid, name: "" },
      { ...valid, name: "x".repeat(101) },
      { ...valid, category: "NOPE" },
      { ...valid, currency: "XYZ" },
      { ...valid, memberEmails: ["not-an-email"] },
      { category: "TRIP", currency: "INR" },
    ]) {
      expect((await CREATE_GROUP(json("POST", bad))).status).toBe(422);
    }
    expect(p.group.create).not.toHaveBeenCalled();
  });

  it("makes the creator an ADMIN and logs the activity", async () => {
    p.group.create.mockResolvedValue({ id: GROUP, name: "Goa Trip" });
    const res = await CREATE_GROUP(json("POST", valid));
    expect(res.status).toBe(201);
    const data = p.group.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "Goa Trip", currency: "INR", createdById: ME });
    expect(data.members.create[0]).toEqual({ userId: ME, role: "ADMIN" });
    expect(p.activity.create.mock.calls[0][0].data).toMatchObject({ type: "GROUP_CREATED", groupId: GROUP, metadata: { groupName: "Goa Trip" } });
  });

  it("adds existing users by email as members, silently skipping unknown emails and yourself", async () => {
    p.user.findMany.mockResolvedValue([{ id: OTHER }]); // only one of the emails exists
    p.group.create.mockResolvedValue({ id: GROUP, name: "Goa Trip" });
    await CREATE_GROUP(json("POST", { ...valid, memberEmails: ["asha@x.com", "ghost@x.com", "me@example.com"] }));
    expect(p.user.findMany.mock.calls[0][0].where).toEqual({ email: { in: ["asha@x.com", "ghost@x.com", "me@example.com"] }, id: { not: ME } });
    expect(p.group.create.mock.calls[0][0].data.members.create).toEqual([{ userId: ME, role: "ADMIN" }, { userId: OTHER, role: "MEMBER" }]);
  });

  it("rate-limits by the first forwarded IP", async () => {
    p.group.create.mockResolvedValue({ id: GROUP, name: "G" });
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await CREATE_GROUP(json("POST", valid, { "x-forwarded-for": "7.7.7.7, 10.0.0.1" }))).status);
    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });
});

describe("PATCH /api/groups/[id] (edit)", () => {
  const edit = (body: unknown) => EDIT_GROUP(json("PATCH", body), ctx);

  it("only admins may edit", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    expect((await edit({ name: "New" })).status).toBe(403);
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await edit({ name: "New" })).status).toBe(403);
    expect(p.group.update).not.toHaveBeenCalled();
  });

  it("updates only the allowed fields", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.group.update.mockResolvedValue({ id: GROUP });
    expect((await edit({ name: "New", description: "d", category: "WORK", currency: "USD", createdById: "hacker", archivedAt: null })).status).toBe(200);
    expect(p.group.update.mock.calls[0][0].data).toEqual({ name: "New", description: "d", category: "WORK", currency: "USD" });
  });

  it("validates input", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect((await edit({ currency: "XYZ" })).status).toBe(422);
  });
});

describe("DELETE /api/groups/[id]", () => {
  it("only the creator may delete — even other admins can't", async () => {
    p.group.findUnique.mockResolvedValue({ id: GROUP, createdById: OTHER });
    expect((await DELETE_GROUP(json("DELETE", {}), ctx)).status).toBe(403);
    expect(p.group.delete).not.toHaveBeenCalled();
  });

  it("404s for a group that doesn't exist and deletes for the creator", async () => {
    p.group.findUnique.mockResolvedValue(null);
    expect((await DELETE_GROUP(json("DELETE", {}), ctx)).status).toBe(404);
    p.group.findUnique.mockResolvedValue({ id: GROUP, createdById: ME });
    p.group.delete.mockResolvedValue({});
    expect((await DELETE_GROUP(json("DELETE", {}), ctx)).status).toBe(200);
    expect(p.group.delete).toHaveBeenCalledWith({ where: { id: GROUP } });
  });
});

describe("PATCH /members (change role)", () => {
  const change = (body: unknown) => CHANGE_ROLE(json("PATCH", body), ctx);

  it("admins only", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    expect((await change({ userId: OTHER, role: "ADMIN" })).status).toBe(403);
  });

  it("validates the input and refuses changing your own role", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect((await change({ userId: OTHER, role: "OWNER" })).status).toBe(400);
    expect((await change({ role: "ADMIN" })).status).toBe(400);
    expect((await change({ userId: ME, role: "MEMBER" })).status).toBe(400);
    expect(p.groupMember.update).not.toHaveBeenCalled();
  });

  it("promotes and demotes other members", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.groupMember.update.mockResolvedValue({ userId: OTHER, role: "ADMIN" });
    expect((await change({ userId: OTHER, role: "ADMIN" })).status).toBe(200);
    expect(p.groupMember.update.mock.calls[0][0]).toMatchObject({ where: { groupId_userId: { groupId: GROUP, userId: OTHER } }, data: { role: "ADMIN" } });
  });
});

describe("POST /members (add by email)", () => {
  const add = (email: string) => ADD_MEMBER(json("POST", { email }), ctx);

  it("members only, with a valid email", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await add("a@b.co")).status).toBe(403);
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.group.findUnique.mockResolvedValue({ archivedAt: null, name: "Goa" });
    expect((await add("nope")).status).toBe(422);
  });

  it("rejects someone who is already a member", async () => {
    p.groupMember.findUnique.mockResolvedValueOnce({ userId: ME }).mockResolvedValueOnce({ userId: OTHER });
    p.group.findUnique.mockResolvedValue({ archivedAt: null, name: "Goa" });
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha" });
    expect((await add("asha@x.com")).status).toBe(409);
    expect(p.groupMember.create).not.toHaveBeenCalled();
  });

  it("adds an existing user, notifies them and the current members", async () => {
    p.groupMember.findUnique.mockResolvedValueOnce({ userId: ME }).mockResolvedValueOnce(null);
    p.group.findUnique.mockResolvedValue({ archivedAt: null, name: "Goa" });
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha" });
    p.groupMember.create.mockResolvedValue({ userId: OTHER });
    p.groupMember.findMany.mockResolvedValue([{ userId: STRANGER }]);
    p.notification.createMany.mockResolvedValue({});
    expect((await add("asha@x.com")).status).toBe(201);
    const batches = p.notification.createMany.mock.calls.map((c: unknown[]) => (c[0] as { data: { userId: string; type: string }[] }).data);
    expect(batches[0][0]).toMatchObject({ userId: OTHER, type: "GROUP_JOINED" });
    expect(batches[1][0]).toMatchObject({ userId: STRANGER });
  });

  it("stores a pending invite for people who haven't signed up", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.group.findUnique.mockResolvedValue({ archivedAt: null, name: "Goa" });
    p.user.findUnique.mockResolvedValue(null);
    p.groupInvite.upsert.mockResolvedValue({});
    const res = await add("new@x.com");
    expect((await res.json()).data).toEqual({ invited: true, email: "new@x.com" });
    expect(p.groupInvite.upsert.mock.calls[0][0].create).toMatchObject({ groupId: GROUP, email: "new@x.com", invitedBy: ME });
  });
});

describe("invite links", () => {
  it("only members can fetch the link", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await GET_INVITE(json("GET", undefined as never), ctx)).status).toBe(403);
  });

  it("returns the existing valid token without rotating it", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    const future = new Date(Date.now() + 86_400_000);
    p.group.findUnique.mockResolvedValue({ id: GROUP, inviteToken: "tok", inviteTokenExpiresAt: future });
    const { data } = await (await GET_INVITE(json("GET", undefined as never), ctx)).json();
    expect(data.token).toBe("tok");
    expect(p.group.update).not.toHaveBeenCalled();
  });

  it("creates a 7-day token when there is none, and rotates an expired one", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    p.group.update.mockImplementation(async ({ data }: { data: { inviteToken: string; inviteTokenExpiresAt: Date } }) => ({ id: GROUP, ...data }));
    p.group.findUnique.mockResolvedValue({ id: GROUP, inviteToken: null, inviteTokenExpiresAt: null });
    const created = (await (await GET_INVITE(json("GET", undefined as never), ctx)).json()).data;
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    const days = (new Date(created.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    p.group.findUnique.mockResolvedValue({ id: GROUP, inviteToken: "old", inviteTokenExpiresAt: new Date(Date.now() - 1000) });
    const rotated = (await (await GET_INVITE(json("GET", undefined as never), ctx)).json()).data;
    expect(rotated.token).not.toBe("old");
  });

  it("only admins can revoke", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    expect((await REVOKE_INVITE(json("DELETE", {}), ctx)).status).toBe(403);
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.group.update.mockResolvedValue({});
    expect((await REVOKE_INVITE(json("DELETE", {}), ctx)).status).toBe(200);
    expect(p.group.update.mock.calls[0][0].data).toEqual({ inviteToken: null, inviteTokenExpiresAt: null });
  });
});

describe("join via invite link", () => {
  const tokenCtx = { params: Promise.resolve({ token: "tok" }) };

  it("previews only valid, unexpired, non-archived invites (no sign-in needed)", async () => {
    authState.user = null;
    p.group.findFirst.mockResolvedValue({ id: GROUP, name: "Goa" });
    expect((await PREVIEW_JOIN(json("GET", undefined as never), tokenCtx)).status).toBe(200);
    const where = p.group.findFirst.mock.calls[0][0].where;
    expect(where.inviteToken).toBe("tok");
    expect(where.inviteTokenExpiresAt.gt).toBeInstanceOf(Date);
    expect(where.archivedAt).toBeNull();

    p.group.findFirst.mockResolvedValue(null);
    expect((await PREVIEW_JOIN(json("GET", undefined as never), tokenCtx)).status).toBe(404);
  });

  it("joining requires sign-in and a valid link", async () => {
    authState.user = null;
    expect((await JOIN(json("POST", {}), tokenCtx)).status).toBe(401);
    authState.user = { id: ME, email: "me@example.com" };
    p.group.findFirst.mockResolvedValue(null);
    expect((await JOIN(json("POST", {}), tokenCtx)).status).toBe(404);
    expect(p.groupMember.create).not.toHaveBeenCalled();
  });

  it("adds the user as a MEMBER and logs it; joining twice is harmless", async () => {
    p.group.findFirst.mockResolvedValue({ id: GROUP });
    p.groupMember.findUnique.mockResolvedValue(null);
    p.groupMember.create.mockResolvedValue({});
    const first = await JOIN(json("POST", {}), tokenCtx);
    expect(first.status).toBe(201);
    expect(p.groupMember.create.mock.calls[0][0].data).toEqual({ groupId: GROUP, userId: ME, role: "MEMBER" });
    expect(p.activity.create.mock.calls[0][0].data).toMatchObject({ type: "MEMBER_ADDED", userId: ME, groupId: GROUP });

    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    const again = await JOIN(json("POST", {}), tokenCtx);
    expect((await again.json()).data).toEqual({ groupId: GROUP, alreadyMember: true });
    expect(p.groupMember.create).toHaveBeenCalledTimes(1);
  });
});
