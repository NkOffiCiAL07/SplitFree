import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return {
    createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }),
    createAdminClient: async () => ({ auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({}) } } }),
  };
});

import { DELETE as REMOVE_MEMBER, POST as ADD_MEMBER } from "@/app/api/groups/[id]/members/route";
import { GET as GET_BUDGET, POST as POST_BUDGET } from "@/app/api/groups/[id]/budget/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({ id: GROUP }) };
const req = (method: string, body?: unknown) =>
  new NextRequest(`http://x/api/groups/${GROUP}/x`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
});

describe("DELETE /members", () => {
  it("requires a userId", async () => {
    expect((await REMOVE_MEMBER(req("DELETE", {}), ctx)).status).toBe(400);
  });

  it("blocks removing the last admin while other members remain", async () => {
    p.groupMember.findUnique
      .mockResolvedValueOnce({ role: "ADMIN" }) // caller
      .mockResolvedValueOnce({ role: "ADMIN" }); // target (same person leaving)
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    p.groupMember.findMany.mockResolvedValue([{ role: "MEMBER" }]);
    const res = await REMOVE_MEMBER(req("DELETE", { userId: ME }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/admin/i);
    expect(p.groupMember.delete).not.toHaveBeenCalled();
  });

  it("lets an admin leave when another admin exists", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "ADMIN" });
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    p.groupMember.findMany.mockResolvedValue([{ role: "ADMIN" }]);
    p.groupMember.delete.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    expect((await REMOVE_MEMBER(req("DELETE", { userId: ME }), ctx)).status).toBe(200);
  });

  it("still blocks leaving with an unsettled balance", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    p.expense.findMany.mockResolvedValue([{ paidById: OTHER, splits: [{ userId: ME, amount: 500 }] }]);
    p.settlement.findMany.mockResolvedValue([]);
    expect((await REMOVE_MEMBER(req("DELETE", { userId: ME }), ctx)).status).toBe(400);
  });
});

describe("POST /members — invite email throttle", () => {
  it("rate-limits invites to non-users per caller", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.user.findUnique.mockResolvedValue(null); // invitee does not exist → sends an email
    p.groupInvite.upsert.mockResolvedValue({});
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await ADD_MEMBER(req("POST", { email: `new${i}@example.com` }), ctx)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe("budgets", () => {
  it("computes spent per budget from the user's own share, period and category", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.budget.findMany.mockResolvedValue([
      { id: "b1", period: "MONTHLY", category: "FOOD", amount: 100000 },
      { id: "b2", period: "WEEKLY", category: null, amount: 50000 },
    ]);
    p.group.findUnique.mockResolvedValue({ currency: "INR" });
    const today = new Date();
    p.expenseSplit.findMany.mockResolvedValue([
      { amount: 25000, expense: { currency: "INR", date: today, category: "FOOD" } },
      { amount: 10000, expense: { currency: "INR", date: today, category: "TRAVEL" } },
    ]);
    const res = await GET_BUDGET(req("GET"), ctx);
    const { data } = await res.json();
    // FOOD budget (monthly) counts only food; the all-categories weekly budget counts everything in its window
    expect(data.budgets.map((b: { spent: number }) => b.spent)).toEqual([25000, 35000]);
    expect(data.currency).toBe("INR");
    expect(data.approximate).toBe(false);

    // only the caller's own shares are read
    expect(p.expenseSplit.findMany.mock.calls[0][0].where.userId).toBe(ME);
  });

  it("updates an existing all-categories budget instead of creating a duplicate NULL row", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.budget.findFirst.mockResolvedValue({ id: "b1" });
    p.budget.update.mockResolvedValue({ id: "b1" });
    const res = await POST_BUDGET(req("POST", { amount: 500, period: "MONTHLY" }), ctx);
    expect(res.status).toBe(201);
    expect(p.budget.update).toHaveBeenCalledOnce();
    expect(p.budget.create).not.toHaveBeenCalled();
    expect(p.budget.update.mock.calls[0][0].data.amount).toBe(50000);
  });

  it("creates the budget when none exists and rejects bad periods", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.budget.findFirst.mockResolvedValue(null);
    p.budget.create.mockResolvedValue({ id: "new" });
    expect((await POST_BUDGET(req("POST", { amount: 500 }), ctx)).status).toBe(201);
    expect(p.budget.create.mock.calls[0][0].data.category).toBeNull();
    expect((await POST_BUDGET(req("POST", { amount: 500, period: "DAILY" }), ctx)).status).toBe(400);
  });
});
