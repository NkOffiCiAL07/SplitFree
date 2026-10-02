import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET, POST } from "@/app/api/expenses/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const body = (over: Record<string, unknown> = {}) => ({
  description: "Dinner", amount: 300, currency: "INR", category: "FOOD", splitType: "EQUAL",
  paidById: ME, groupId: GROUP, date: "2026-01-01", isRecurring: false,
  participants: [ME, OTHER], ...over,
});
const post = (b: unknown) =>
  POST(new NextRequest("http://x/api/expenses", { method: "POST", body: JSON.stringify(b), headers: { "x-forwarded-for": `9.9.9.${Math.floor(Math.random() * 250)}` } }));

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.findUnique.mockResolvedValue({ id: ME });
});

describe("POST /api/expenses — integrity", () => {
  it("rejects signed-out users", async () => {
    authState.user = null;
    expect((await post(body())).status).toBe(401);
  });

  it("rejects callers who are not members of the group", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    expect((await post(body())).status).toBe(403);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("rejects participants who are not group members", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    const res = await post(body({ participants: [ME, STRANGER] }));
    expect(res.status).toBe(403);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a payer who is not in the group", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    expect((await post(body({ paidById: STRANGER }))).status).toBe(403);
  });

  it("rejects strangers outside a group (not a friend, group-mate or expense-mate)", async () => {
    p.friendship.findMany.mockResolvedValue([]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    const res = await post(body({ groupId: null, participants: [ME, STRANGER] }));
    expect(res.status).toBe(403);
  });

  it("creates the expense when everyone belongs to the group", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" }, groupId: GROUP });
    p.notification.createMany.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    const res = await post(body());
    expect(res.status).toBe(201);
    const data = p.expense.create.mock.calls[0][0].data;
    expect(data.amount).toBe(30000);
    expect(data.currency).toBe("INR");
    expect(data.splits.create.map((s: { amount: number }) => s.amount)).toEqual([15000, 15000]);
  });

  it("defaults the currency to INR when omitted", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" }, groupId: GROUP });
    p.notification.createMany.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    const { currency: _omit, ...rest } = body();
    void _omit;
    await post(rest);
    expect(p.expense.create.mock.calls[0][0].data.currency).toBe("INR");
  });
});

describe("GET /api/expenses — visibility", () => {
  it("includes expenses the user paid even when they are not in the split", async () => {
    p.expense.findMany.mockResolvedValue([]);
    await GET(new NextRequest("http://x/api/expenses?limit=abc"));
    const args = p.expense.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([{ splits: { some: { userId: ME } } }, { paidById: ME }]);
    expect(args.take).toBe(50); // invalid limit falls back to the default
    expect(args.orderBy).toEqual([{ date: "desc" }, { id: "desc" }]); // stable pagination
  });
});
