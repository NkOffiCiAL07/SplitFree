import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET as GET_PROFILE, PATCH as PATCH_PROFILE } from "@/app/api/profile/route";
import { GET as GET_BUDGET, POST as POST_BUDGET, DELETE as DELETE_BUDGET } from "@/app/api/groups/[id]/budget/route";
import { GET as GET_EXPENSE, PATCH as PATCH_EXPENSE, DELETE as DELETE_EXPENSE } from "@/app/api/expenses/[id]/route";
import { GET as GET_GROUP } from "@/app/api/groups/[id]/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const EXP = "55555555-5555-4555-8555-555555555555";
const gctx = { params: Promise.resolve({ id: GROUP }) };
const ectx = { params: Promise.resolve({ id: EXP }) };
const req = (method: string, body?: unknown) => new NextRequest("http://x/api", { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/api/profile", () => {
  it("GET returns the signed-in user's profile, 404 when there is none, 401 signed out", async () => {
    p.user.findUnique.mockResolvedValue({ id: ME, name: "Nishant", currency: "INR" });
    const res = await GET_PROFILE();
    expect((await res.json()).data).toMatchObject({ name: "Nishant" });
    expect(p.user.findUnique.mock.calls[0][0].where).toEqual({ id: ME });
    p.user.findUnique.mockResolvedValue(null);
    expect((await GET_PROFILE()).status).toBe(404);
    authState.user = null;
    expect((await GET_PROFILE()).status).toBe(401);
  });

  it("PATCH updates only the signed-in user's own row, whatever id the body claims", async () => {
    p.user.update.mockResolvedValue({ id: ME });
    await PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "New", id: STRANGER, email: "evil@x.com" }) }));
    const args = p.user.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: ME });
    expect(args.data).toEqual({ name: "New" }); // id/email are not editable here
  });

  it("PATCH validates name, currency and avatar URL", async () => {
    const patch = (body: unknown) => PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }));
    expect((await patch({ name: "" })).status).toBe(422);
    expect((await patch({ name: "x".repeat(101) })).status).toBe(422);
    expect((await patch({ currency: "XYZ" })).status).toBe(422);
    expect((await patch({ avatarUrl: "not a url" })).status).toBe(422);
    p.user.update.mockResolvedValue({});
    expect((await patch({ currency: "INR", avatarUrl: null })).status).toBe(200);
  });

  it("requires sign-in and turns database failures into a 500", async () => {
    authState.user = null;
    expect((await PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: "{}" }))).status).toBe(401);
    authState.user = { id: ME, email: "me@example.com" };
    p.user.update.mockRejectedValue(new Error("db down"));
    expect((await PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }))).status).toBe(500);
  });
});

describe("/api/groups/[id]/budget — permissions and validation", () => {
  it("GET and POST refuse non-members; DELETE only touches the caller's own budget", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await GET_BUDGET(req("GET"), gctx)).status).toBe(403);
    expect((await POST_BUDGET(req("POST", { amount: 100 }), gctx)).status).toBe(403);
    p.budget.deleteMany.mockResolvedValue({});
    expect((await DELETE_BUDGET(req("DELETE", { budgetId: "b1" }), gctx)).status).toBe(200);
    expect(p.budget.deleteMany).toHaveBeenCalledWith({ where: { id: "b1", userId: ME, groupId: GROUP } });
  });

  it("POST rejects missing, zero and negative amounts", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    for (const amount of [undefined, 0, -5]) {
      expect((await POST_BUDGET(req("POST", { amount }), gctx)).status).toBe(400);
    }
    expect(p.budget.create).not.toHaveBeenCalled();
  });

  it("covers weekly and yearly windows too", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.budget.findMany.mockResolvedValue([{ id: "w", period: "WEEKLY", category: null }, { id: "y", period: "YEARLY", category: null }]);
    p.expenseSplit.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const { data } = await (await GET_BUDGET(req("GET"), gctx)).json();
    expect(data.budgets.map((b: { spent: number }) => b.spent)).toEqual([0, 0]); // null sums become 0
    const ranges = p.expenseSplit.aggregate.mock.calls.map((c: unknown[]) => (c[0] as { where: { expense: { date: { gte: Date; lte: Date } } } }).where.expense.date);
    const weekMs = ranges[0].lte.getTime() - ranges[0].gte.getTime();
    const yearMs = ranges[1].lte.getTime() - ranges[1].gte.getTime();
    expect(Math.round(weekMs / 86_400_000)).toBe(7);
    expect(Math.round(yearMs / 86_400_000)).toBeGreaterThanOrEqual(365);
  });
});

describe("/api/expenses/[id] — remaining paths", () => {
  const stored = (over = {}) => ({
    id: EXP, groupId: GROUP, amount: 30000, paidById: ME, description: "Dinner", currency: "INR", category: "FOOD",
    date: new Date("2026-03-01"), splitType: "EQUAL", notes: null, isRecurring: false, recurringInterval: null,
    splits: [{ userId: ME, amount: 15000 }, { userId: OTHER, amount: 15000 }], payers: [], ...over,
  });

  it("GET returns a visible expense with who paid and the splits", async () => {
    p.expense.findFirst.mockResolvedValue(stored());
    expect((await GET_EXPENSE(req("GET"), ectx)).status).toBe(200);
    const include = p.expense.findFirst.mock.calls[0][0].include;
    expect(Object.keys(include).sort()).toEqual(["group", "paidBy", "payers", "splits"]);
  });

  it("GET survives a database failure", async () => {
    p.expense.findFirst.mockRejectedValue(new Error("db"));
    expect((await GET_EXPENSE(req("GET"), ectx)).status).toBe(500);
  });

  it("PATCH refuses non-members of the group (even if they can see the expense)", async () => {
    p.expense.findFirst.mockResolvedValue(stored({ paidById: OTHER }));
    p.group.findUnique.mockResolvedValue({ archivedAt: null });
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await PATCH_EXPENSE(req("PATCH", { description: "x" }), ectx)).status).toBe(403);
  });

  it("PATCH validates the body", async () => {
    p.expense.findFirst.mockResolvedValue(stored());
    p.group.findUnique.mockResolvedValue({ archivedAt: null });
    expect((await PATCH_EXPENSE(req("PATCH", { amount: -5 }), ectx)).status).toBe(422);
    expect((await PATCH_EXPENSE(req("PATCH", { category: "NOPE" }), ectx)).status).toBe(422);
  });

  it("DELETE removes the expense, notifies the other group members and logs it", async () => {
    p.expense.findFirst.mockResolvedValue(stored());
    p.group.findUnique.mockResolvedValue({ archivedAt: null });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }, { userId: STRANGER }]);
    p.expense.delete.mockResolvedValue({});
    p.user.findUnique.mockResolvedValue({ name: "Nishant" });
    p.notification.createMany.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    expect((await DELETE_EXPENSE(req("DELETE"), ectx)).status).toBe(200);
    expect(p.expense.delete).toHaveBeenCalledWith({ where: { id: EXP } });
    const rows = p.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId)).toEqual([OTHER, STRANGER]); // never the person who deleted it
    expect(rows[0]).toMatchObject({ type: "EXPENSE_DELETED", title: "Nishant deleted an expense" });
    expect(p.activity.create.mock.calls[0][0].data).toMatchObject({ type: "EXPENSE_DELETED", userId: ME, groupId: GROUP });
  });

  it("DELETE: only a payer can delete a personal (non-group) expense", async () => {
    p.expense.findFirst.mockResolvedValue(stored({ groupId: null, paidById: OTHER }));
    expect((await DELETE_EXPENSE(req("DELETE"), ectx)).status).toBe(403);
    expect(p.expense.delete).not.toHaveBeenCalled();
  });

  it("DELETE: a group member who isn't the payer may delete; a non-member may not", async () => {
    p.expense.findFirst.mockResolvedValue(stored({ paidById: OTHER }));
    p.group.findUnique.mockResolvedValue({ archivedAt: null });
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await DELETE_EXPENSE(req("DELETE"), ectx)).status).toBe(403);
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([]);
    p.expense.delete.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    expect((await DELETE_EXPENSE(req("DELETE"), ectx)).status).toBe(200);
  });
});

describe("/api/groups/[id] GET — failure paths", () => {
  it("404s when the group row is missing after the membership check", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.group.findUnique.mockResolvedValue(null);
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    expect((await GET_GROUP(req("GET"), gctx)).status).toBe(404);
  });

  it("returns a clean 500 on database errors", async () => {
    p.groupMember.findUnique.mockRejectedValue(new Error("db"));
    expect((await GET_GROUP(req("GET"), gctx)).status).toBe(500);
  });
});
