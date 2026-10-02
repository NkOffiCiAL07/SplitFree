import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET } from "@/app/api/friends/[id]/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = (id: string) => GET(new NextRequest(`http://x/api/friends/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  // OTHER is a friend; STRANGER is unknown to the caller
  p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
  p.groupMember.findMany.mockResolvedValue([]);
  p.expenseSplit.findMany.mockResolvedValue([]);
});

describe("GET /api/friends/[id]", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await call(OTHER)).status).toBe(401);
  });

  it("refuses yourself and people you don't know", async () => {
    expect((await call(ME)).status).toBe(400);
    expect((await call(STRANGER)).status).toBe(404);
    expect(p.expense.findMany).not.toHaveBeenCalled();
  });

  const exp = (over: Record<string, unknown>) => ({
    id: "e1", description: "Dinner", amount: 1000, currency: "INR", category: "FOOD", date: new Date(), paidById: ME,
    groupId: null, group: null, payers: [], splits: [{ userId: ME, amount: 500 }, { userId: OTHER, amount: 500 }], ...over,
  });

  it("returns the friend, per-currency balance and shared history", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([exp({})]);
    p.settlement.findMany.mockResolvedValue([
      { id: "s1", fromUserId: OTHER, toUserId: ME, amount: 200, currency: "INR", note: null, createdAt: new Date(), groupId: null },
    ]);
    const res = await call(OTHER);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.friend.name).toBe("Asha");
    expect(data.balances).toEqual([{ currency: "INR", net: 300 }]); // 500 owed - 200 paid back
    expect(data.expenses).toHaveLength(1);
    expect(data.expenses[0]).toMatchObject({ delta: 500, multiplePayers: false }); // she owes me ₹5 for this one
    expect(data.settlements).toHaveLength(1);
  });

  it("returns the friend's saved UPI ID (for one-tap payment) and asks the database for it", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null, upiId: "asha@ybl" });
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await call(OTHER)).json();
    expect(data.friend.upiId).toBe("asha@ybl");
    expect(p.user.findUnique.mock.calls[0][0].select).toMatchObject({ upiId: true });
  });

  it("asks for expenses I can see that involve the friend as payer, co-payer or in the split", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    await call(OTHER);
    const where = p.expense.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toContainEqual({ paidById: ME });
    expect(where.AND[1].OR).toEqual([
      { paidById: OTHER }, { splits: { some: { userId: OTHER } } }, { payers: { some: { userId: OTHER } } },
    ]);
  });

  it("skips expenses that create no debt between the two of you (a third person paid)", async () => {
    const THIRD = "66666666-6666-4666-8666-666666666666";
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([
      exp({ id: "t", paidById: THIRD, amount: 900, splits: [{ userId: ME, amount: 300 }, { userId: OTHER, amount: 300 }, { userId: THIRD, amount: 300 }] }),
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await call(OTHER)).json();
    expect(data.expenses).toEqual([]);
    expect(data.balances).toEqual([]);
  });

  it("handles multiple payers and flags them", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([
      exp({
        amount: 900, payers: [{ userId: ME, amount: 800 }, { userId: OTHER, amount: 100 }],
        splits: [{ userId: ME, amount: 300 }, { userId: OTHER, amount: 600 }],
      }),
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await call(OTHER)).json();
    // Asha paid 100 but consumed 600 → owes me 500
    expect(data.balances).toEqual([{ currency: "INR", net: 500 }]);
    expect(data.expenses[0]).toMatchObject({ delta: 500, multiplePayers: true });
  });

  it("computes balances from ALL history but returns only the latest 50 expenses", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue(
      Array.from({ length: 80 }, (_, i) => exp({ id: `e${i}`, amount: 200, splits: [{ userId: ME, amount: 100 }, { userId: OTHER, amount: 100 }] }))
    );
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await call(OTHER)).json();
    expect(data.expenses).toHaveLength(50);
    expect(data.balances).toEqual([{ currency: "INR", net: 8000 }]); // 80 × 100, not 50 × 100
  });
});
