import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return {
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }),
    createAdminClient: async () => ({ auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({}) } } }),
  };
});

import { POST as ARCHIVE } from "@/app/api/groups/[id]/archive/route";
import { GET as LIST_GROUPS } from "@/app/api/groups/route";
import { POST as CREATE_EXPENSE } from "@/app/api/expenses/route";
import { PATCH as EDIT_EXPENSE, DELETE as DELETE_EXPENSE } from "@/app/api/expenses/[id]/route";
import { POST as ADD_MEMBER } from "@/app/api/groups/[id]/members/route";
import { POST as JOIN } from "@/app/api/join/[token]/route";
import { POST as SETTLE } from "@/app/api/settlements/route";
import { GET as CRON } from "@/app/api/cron/process-recurring/route";
import { GET as SEARCH } from "@/app/api/search/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({ id: GROUP }) };
const post = (url: string, body: unknown) => new NextRequest(`http://x${url}`, { method: "POST", body: JSON.stringify(body) });
const EXP = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.findUnique.mockResolvedValue({ id: ME, name: "Me" });
});

describe("POST /api/groups/[id]/archive", () => {
  it("lets an admin archive a group (sets archivedAt)", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.group.findUnique.mockResolvedValue({ id: GROUP, archivedAt: null });
    p.group.update.mockResolvedValue({ id: GROUP, archivedAt: new Date() });
    const res = await ARCHIVE(post("/x", { archived: true }), ctx);
    expect(res.status).toBe(200);
    expect(p.group.update.mock.calls[0][0].data.archivedAt).toBeInstanceOf(Date);
  });

  it("restores a group (clears archivedAt)", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.group.findUnique.mockResolvedValue({ id: GROUP, archivedAt: new Date() });
    p.group.update.mockResolvedValue({ id: GROUP, archivedAt: null });
    expect((await ARCHIVE(post("/x", { archived: false }), ctx)).status).toBe(200);
    expect(p.group.update.mock.calls[0][0].data.archivedAt).toBeNull();
  });

  it("is a no-op when the group is already in the requested state", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.group.findUnique.mockResolvedValue({ id: GROUP, archivedAt: new Date() });
    expect((await ARCHIVE(post("/x", { archived: true }), ctx)).status).toBe(200);
    expect(p.group.update).not.toHaveBeenCalled();
  });

  it("is admin-only and members-only", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    expect((await ARCHIVE(post("/x", { archived: true }), ctx)).status).toBe(403);
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await ARCHIVE(post("/x", { archived: true }), ctx)).status).toBe(403);
    expect(p.group.update).not.toHaveBeenCalled();
  });

  it("validates the body and requires sign-in", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect((await ARCHIVE(post("/x", { archived: "yes" }), ctx)).status).toBe(422);
    authState.user = null;
    expect((await ARCHIVE(post("/x", { archived: true }), ctx)).status).toBe(401);
  });
});

describe("listing", () => {
  const list = (qs = "") => LIST_GROUPS(new NextRequest(`http://x/api/groups${qs}`));

  it("shows only active groups by default and only archived ones with ?archived=true", async () => {
    p.group.findMany.mockResolvedValue([]);
    await list();
    expect(p.group.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
    await list("?archived=true");
    expect(p.group.findMany.mock.calls[1][0].where.archivedAt).toEqual({ not: null });
  });

  it("search never suggests archived groups", async () => {
    p.group.findMany.mockResolvedValue([]);
    p.expense.findMany.mockResolvedValue([]);
    p.friendship.findMany.mockResolvedValue([]);
    await SEARCH(new NextRequest("http://x/api/search?q=goa"));
    expect(p.group.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
  });
});

describe("archived groups are read-only", () => {
  const expenseBody = {
    description: "Dinner", amount: 300, currency: "INR", category: "FOOD", splitType: "EQUAL", paidById: ME,
    groupId: GROUP, date: "2026-01-01", isRecurring: false, participants: [ME, OTHER],
  };

  it("rejects new expenses with a 409", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.group.findUnique.mockResolvedValue({ archivedAt: new Date() });
    const res = await CREATE_EXPENSE(new NextRequest("http://x/api/expenses", { method: "POST", body: JSON.stringify(expenseBody), headers: { "x-forwarded-for": "8.8.8.8" } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toMatch(/archived/i);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("rejects editing and deleting expenses", async () => {
    p.expense.findFirst.mockResolvedValue({ id: EXP, groupId: GROUP, paidById: ME, amount: 100, payers: [], splits: [] });
    p.group.findUnique.mockResolvedValue({ archivedAt: new Date() });
    const idCtx = { params: Promise.resolve({ id: EXP }) };
    expect((await EDIT_EXPENSE(new NextRequest("http://x", { method: "PATCH", body: JSON.stringify({ description: "x" }) }), idCtx)).status).toBe(409);
    expect((await DELETE_EXPENSE(new NextRequest("http://x", { method: "DELETE" }), idCtx)).status).toBe(409);
    expect(p.expense.update).not.toHaveBeenCalled();
    expect(p.expense.delete).not.toHaveBeenCalled();
  });

  it("rejects adding members", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.group.findUnique.mockResolvedValue({ archivedAt: new Date() });
    expect((await ADD_MEMBER(post("/x", { email: "a@b.co" }), ctx)).status).toBe(409);
  });

  it("can't be joined through an invite link", async () => {
    p.group.findFirst.mockResolvedValue(null);
    const res = await JOIN(new NextRequest("http://x", { method: "POST" }), { params: Promise.resolve({ token: "t" }) });
    expect(res.status).toBe(404);
    expect(p.group.findFirst.mock.calls[0][0].where.archivedAt).toBeNull();
  });

  it("still lets people settle up", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.settlement.create.mockResolvedValue({ id: "s", fromUser: { name: "Me" }, toUser: { name: "Pal" } });
    p.notification.create.mockResolvedValue({});
    p.groupMember.findMany.mockResolvedValue([]);
    p.activity.create.mockResolvedValue({});
    const res = await SETTLE(post("/api/settlements", { toUserId: OTHER, amount: 50, currency: "INR", groupId: GROUP }));
    expect(res.status).toBe(201);
  });

  it("recurring expenses are not generated into archived groups", async () => {
    vi.stubEnv("CRON_SECRET", "s");
    p.expense.findMany.mockResolvedValue([]);
    await CRON(new NextRequest("http://x", { headers: { authorization: "Bearer s" } }));
    expect(p.expense.findMany.mock.calls[0][0].where.OR).toEqual([{ groupId: null }, { group: { archivedAt: null } }]);
    vi.unstubAllEnvs();
  });
});
