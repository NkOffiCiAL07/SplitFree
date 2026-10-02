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
    expect(args.where.AND[0].OR).toEqual([{ splits: { some: { userId: ME } } }, { paidById: ME }, { payers: { some: { userId: ME } } }]);
    expect(args.take).toBe(50); // invalid limit falls back to the default
    expect(args.orderBy).toEqual([{ date: "desc" }, { id: "desc" }]); // stable pagination
  });
});

describe("POST /api/expenses — multiple payers", () => {
  const setup = () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" }, groupId: GROUP });
    p.notification.createMany.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
  };

  it("stores each payer's amount in cents and uses the biggest payer as the primary", async () => {
    setup();
    const res = await post(body({ payers: [{ userId: OTHER, amount: 100 }, { userId: ME, amount: 200 }] }));
    expect(res.status).toBe(201);
    const data = p.expense.create.mock.calls[0][0].data;
    expect(data.paidById).toBe(ME);
    expect(data.payers.create).toEqual([{ userId: OTHER, amount: 10000 }, { userId: ME, amount: 20000 }]);
    expect(data.amount).toBe(30000);
  });

  it("rejects payers that don't add up to the total", async () => {
    setup();
    const res = await post(body({ payers: [{ userId: ME, amount: 200 }, { userId: OTHER, amount: 99 }] }));
    expect(res.status).toBe(400);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a lone payer and duplicate payers", async () => {
    setup();
    expect((await post(body({ payers: [{ userId: ME, amount: 300 }] }))).status).toBe(400);
    expect((await post(body({ payers: [{ userId: ME, amount: 150 }, { userId: ME, amount: 150 }] }))).status).toBe(400);
  });

  it("rejects payers who are not members of the group", async () => {
    setup();
    const res = await post(body({ payers: [{ userId: ME, amount: 200 }, { userId: STRANGER, amount: 100 }] }));
    expect(res.status).toBe(403);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("does not create payer rows for an ordinary single-payer expense", async () => {
    setup();
    await post(body());
    expect(p.expense.create.mock.calls[0][0].data).not.toHaveProperty("payers");
  });

  it("notifies everyone except the payers", async () => {
    const THIRD = "77777777-7777-4777-8777-777777777777";
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }, { userId: THIRD }]);
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" }, groupId: GROUP });
    p.notification.createMany.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    await post(body({ payers: [{ userId: ME, amount: 200 }, { userId: OTHER, amount: 100 }], participants: [ME, OTHER, THIRD] }));
    const notified = p.notification.createMany.mock.calls[0][0].data.map((n: { userId: string }) => n.userId);
    expect(notified).toEqual([THIRD]); // both payers already know about it
  });
});

describe("GET /api/expenses — search, filters and paging", () => {
  const row = (id: string) => ({ id, description: id, amount: 100, splits: [], payers: [] });

  it("passes search/category/date filters to the database (full history, not just a page)", async () => {
    p.expense.findMany.mockResolvedValue([]);
    await GET(new NextRequest("http://x/api/expenses?q=goa&category=FOOD&from=2026-01-01&recurring=true&groupId=" + GROUP));
    const and = p.expense.findMany.mock.calls[0][0].where.AND;
    expect(and[1].AND).toEqual(expect.arrayContaining([
      { groupId: GROUP }, { category: "FOOD" }, { isRecurring: true },
      expect.objectContaining({ OR: expect.any(Array) }),
      { date: { gte: new Date("2026-01-01T00:00:00.000Z") } },
    ]));
    expect(and[0].OR).toBeDefined(); // visibility is always applied
  });

  it("still returns a plain array without ?paged", async () => {
    p.expense.findMany.mockResolvedValue([row("a")]);
    const { data } = await (await GET(new NextRequest("http://x/api/expenses"))).json();
    expect(Array.isArray(data)).toBe(true);
    expect(p.expense.findMany.mock.calls[0][0].take).toBe(50);
  });

  it("paged: asks for one extra row and returns a cursor only when more exist", async () => {
    p.expense.findMany.mockResolvedValue([row("a"), row("b"), row("c")]); // limit 2 → 3 rows means more
    const first = (await (await GET(new NextRequest("http://x/api/expenses?paged=true&limit=2"))).json()).data;
    expect(p.expense.findMany.mock.calls[0][0].take).toBe(3);
    expect(first.items.map((e: { id: string }) => e.id)).toEqual(["a", "b"]);
    expect(first.nextCursor).toBe("b");

    p.expense.findMany.mockResolvedValue([row("c")]);
    const last = (await (await GET(new NextRequest("http://x/api/expenses?paged=true&limit=2&cursor=b"))).json()).data;
    expect(last).toEqual({ items: [expect.objectContaining({ id: "c" })], nextCursor: null });
    expect(p.expense.findMany.mock.calls[1][0]).toMatchObject({ skip: 1, cursor: { id: "b" } });
  });

  it("an exactly-full last page has no cursor", async () => {
    p.expense.findMany.mockResolvedValue([row("a"), row("b")]);
    const { data } = await (await GET(new NextRequest("http://x/api/expenses?paged=true&limit=2"))).json();
    expect(data.nextCursor).toBeNull();
  });
});
