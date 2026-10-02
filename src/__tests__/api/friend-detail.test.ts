import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
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

  it("returns the friend, per-currency balance and shared history", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([
      { id: "e1", description: "Dinner", amount: 1000, currency: "INR", category: "FOOD", date: new Date(), paidById: ME, group: null,
        splits: [{ userId: ME, amount: 500 }, { userId: OTHER, amount: 500 }] },
    ]);
    p.settlement.findMany.mockResolvedValue([
      { id: "s1", fromUserId: OTHER, toUserId: ME, amount: 200, currency: "INR", note: null, createdAt: new Date() },
    ]);
    const res = await call(OTHER);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.friend.name).toBe("Asha");
    expect(data.balances).toEqual([{ currency: "INR", net: 300 }]); // 500 owed - 200 paid back
    expect(data.expenses).toHaveLength(1);
    expect(data.settlements).toHaveLength(1);
  });

  it("only asks for expenses where one of the two paid and the other is in the split", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    await call(OTHER);
    expect(p.expense.findMany.mock.calls[0][0].where.OR).toEqual([
      { paidById: ME, splits: { some: { userId: OTHER } } },
      { paidById: OTHER, splits: { some: { userId: ME } } },
    ]);
  });

  it("computes balances from ALL history but returns only the latest 50 expenses", async () => {
    p.user.findUnique.mockResolvedValue({ id: OTHER, name: "Asha", email: "a@x.com", avatarUrl: null });
    p.expense.findMany.mockResolvedValue(
      Array.from({ length: 80 }, (_, i) => ({
        id: `e${i}`, description: "x", amount: 200, currency: "INR", category: "FOOD", date: new Date(), paidById: ME, group: null,
        splits: [{ userId: ME, amount: 100 }, { userId: OTHER, amount: 100 }],
      }))
    );
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await call(OTHER)).json();
    expect(data.expenses).toHaveLength(50);
    expect(data.balances).toEqual([{ currency: "INR", net: 8000 }]); // 80 × 100, not 50 × 100
  });
});
