import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET } from "@/app/api/groups/[id]/route";
import { DELETE as REMOVE_MEMBER } from "@/app/api/groups/[id]/members/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({ id: GROUP }) };
const user = (id: string, name: string) => ({ id, name, avatarUrl: null });
const member = (id: string, name: string) => ({ userId: id, role: "MEMBER", joinedAt: new Date(), user: user(id, name) });
const split = (userId: string, amount: number) => ({ userId, amount });

const exp = (over: Record<string, unknown>) => ({
  id: "e", paidById: ME, currency: "INR", amount: 900, groupId: GROUP, date: new Date(), category: "FOOD", payers: [], splits: [], ...over,
});

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.groupMember.findUnique.mockResolvedValue({ userId: ME, role: "ADMIN" });
});

describe("GET /api/groups/[id]", () => {
  const seed = (expenses: unknown[], settlements: unknown[] = []) => {
    p.group.findUnique.mockResolvedValue({
      id: GROUP, name: "Goa", currency: "INR", expenses: [],
      members: [member(ME, "Me"), member(OTHER, "Asha"), member(STRANGER, "Bhanu")],
    });
    p.expense.findMany.mockResolvedValue(expenses);
    p.settlement.findMany.mockResolvedValue(settlements);
  };

  it("refuses non-members", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://x"), ctx)).status).toBe(403);
  });

  it("computes per-member balances from the shared ledger, including multiple payers", async () => {
    seed([
      // I paid 600, Asha paid 300; split three ways → Bhanu owes me 300, Asha is square with me
      exp({ payers: [{ userId: ME, amount: 600 }, { userId: OTHER, amount: 300 }], splits: [split(ME, 300), split(OTHER, 300), split(STRANGER, 300)] }),
    ]);
    const { data } = await (await GET(new NextRequest("http://x"), ctx)).json();
    expect(data.memberBalances).toEqual([expect.objectContaining({ userId: STRANGER, balance: 300, others: [] })]);
  });

  it("applies every settlement in the group, including payments between other members", async () => {
    seed(
      [exp({ paidById: OTHER, splits: [split(ME, 300), split(OTHER, 300), split(STRANGER, 300)] })],
      [{ fromUserId: ME, toUserId: OTHER, amount: 300, currency: "INR", groupId: GROUP }]
    );
    const { data } = await (await GET(new NextRequest("http://x"), ctx)).json();
    expect(data.memberBalances).toEqual([]); // I paid Asha back, nothing left
  });

  it("reports other-currency balances separately from the group's currency balance", async () => {
    seed([
      exp({ paidById: ME, amount: 1000, splits: [split(ME, 500), split(OTHER, 500)] }),
      exp({ id: "u", paidById: ME, currency: "USD", amount: 40, splits: [split(ME, 20), split(OTHER, 20)] }),
    ]);
    const { data } = await (await GET(new NextRequest("http://x"), ctx)).json();
    expect(data.memberBalances[0]).toMatchObject({ userId: OTHER, balance: 500, others: [{ currency: "USD", net: 20 }] });
  });

  it("includes spending stats with a category breakdown and multi-payer 'paid' totals", async () => {
    seed([
      exp({ amount: 900, category: "FOOD", payers: [{ userId: ME, amount: 600 }, { userId: OTHER, amount: 300 }], splits: [split(ME, 450), split(OTHER, 450)] }),
      exp({ id: "t", amount: 300, category: "TRAVEL", splits: [split(ME, 150), split(OTHER, 150)] }),
    ]);
    const { data } = await (await GET(new NextRequest("http://x"), ctx)).json();
    expect(data.stats).toMatchObject({ total: 1200, yourShare: 600, yourPaid: 900, currency: "INR" });
    expect(data.stats.byCategory.map((c: { category: string }) => c.category)).toEqual(["FOOD", "TRAVEL"]);
  });
});

describe("DELETE /members — leaving with multi-payer balances", () => {
  const remove = (userId: string) =>
    REMOVE_MEMBER(new NextRequest("http://x", { method: "DELETE", body: JSON.stringify({ userId }) }), ctx);

  it("blocks leaving when a multi-payer expense leaves me owed money", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    p.expense.findMany.mockResolvedValue([
      exp({ payers: [{ userId: ME, amount: 600 }, { userId: OTHER, amount: 300 }], splits: [split(ME, 300), split(OTHER, 300), split(STRANGER, 300)] }),
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    const res = await remove(ME);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/owed money/i);
  });

  it("allows leaving once settled", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    p.expense.findMany.mockResolvedValue([exp({ splits: [split(ME, 450), split(OTHER, 450)] })]);
    p.settlement.findMany.mockResolvedValue([{ fromUserId: OTHER, toUserId: ME, amount: 450, currency: "INR", groupId: GROUP }]);
    p.groupMember.delete.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    expect((await remove(ME)).status).toBe(200);
  });

  it("blocks leaving when I owe money in any currency", async () => {
    p.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    p.expense.findMany.mockResolvedValue([exp({ paidById: OTHER, currency: "USD", amount: 40, splits: [split(ME, 20), split(OTHER, 20)] })]);
    p.settlement.findMany.mockResolvedValue([]);
    const res = await remove(ME);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/owe money/i);
  });
});
