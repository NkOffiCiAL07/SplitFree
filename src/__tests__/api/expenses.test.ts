import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
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
    p.$queryRaw.mockResolvedValue([{ id: "paid-by-me" }, { id: "in-the-split" }]);
    await GET(new NextRequest("http://x/api/expenses?limit=abc"));
    const args = p.expense.findMany.mock.calls[0][0];
    // visibility = the ids found through the indexes (below), which cover all three ways of being involved
    expect(args.where.AND[0]).toEqual({ id: { in: ["paid-by-me", "in-the-split"] } });
    const [sql, ...values] = p.$queryRaw.mock.calls[0] as [string[], ...string[]];
    const text = sql.join("?");
    expect(text).toMatch(/FROM expense_splits WHERE user_id/);
    expect(text).toMatch(/FROM expense_payers WHERE user_id/);
    expect(text).toMatch(/FROM expenses WHERE paid_by_id/);
    expect(values).toEqual([ME, ME, ME]); // always the signed-in person, passed as a parameter (never pasted into the SQL)
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
    expect(and[0]).toEqual({ id: { in: [] } }); // visibility is always applied (here: nothing visible)
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

describe("POST /api/expenses — safe retries (clientId)", () => {
  const CID = "11111111-1111-4111-8111-111111111111";

  it("uses the clientId as the new expense's id", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.findUnique.mockResolvedValue(null);
    p.expense.create.mockResolvedValue({ id: CID, paidBy: { name: "Me" } });
    expect((await post(body({ clientId: CID }))).status).toBe(201);
    expect(p.expense.create.mock.calls[0][0].data.id).toBe(CID);
  });

  it("a retry of an already-saved expense returns it (200) and creates nothing", async () => {
    p.expense.findUnique.mockResolvedValue({ id: CID });
    p.expense.findFirst.mockResolvedValue({ id: CID, description: "Dinner" });
    const res = await post(body({ clientId: CID }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(CID);
    expect(p.expense.create).not.toHaveBeenCalled();
    expect(p.activity.create).not.toHaveBeenCalled(); // no second activity entry / notification
  });

  it("an id that belongs to someone else's expense is refused, never leaked", async () => {
    p.expense.findUnique.mockResolvedValue({ id: CID });
    p.expense.findFirst.mockResolvedValue(null);
    expect((await post(body({ clientId: CID }))).status).toBe(409);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a clientId that isn't a UUID", async () => {
    expect((await post(body({ clientId: "abc" }))).status).toBe(422);
  });

  it("without a clientId, the database generates the id as before", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" } });
    await post(body());
    expect(p.expense.create.mock.calls[0][0].data).not.toHaveProperty("id");
    expect(p.expense.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/expenses — money safety", () => {
  const CID = "33333333-3333-4333-8333-333333333333";
  const asMember = () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
  };

  it.each([
    ["exact amounts a cent short", { splitType: "EXACT", amount: 10, splits: { [ME]: 5, [OTHER]: 4.99 } }],
    ["exact amounts a cent over", { splitType: "EXACT", amount: 10, splits: { [ME]: 5, [OTHER]: 5.01 } }],
    ["a negative exact amount", { splitType: "EXACT", amount: 10, splits: { [ME]: 15, [OTHER]: -5 } }],
    ["percentages not adding to 100", { splitType: "PERCENTAGE", splits: { [ME]: 50, [OTHER]: 40 } }],
    ["a negative share", { splitType: "SHARES", splits: { [ME]: 3, [OTHER]: -1 } }],
    ["all-zero shares", { splitType: "SHARES", splits: { [ME]: 0, [OTHER]: 0 } }],
  ])("%s → 400 (a final answer: a queued retry must not loop forever), nothing saved", async (_name, over) => {
    asMember();
    const res = await post(body(over));
    expect(res.status).toBe(400);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("whatever the split type, the saved shares add up to the total exactly", async () => {
    asMember();
    p.expense.create.mockImplementation(async ({ data }: { data: { splits: { create: { amount: number }[] }; amount: number } }) => ({ id: "e", paidBy: { name: "Me" }, saved: data }));
    for (const over of [{ amount: 100 }, { amount: 0.1 }, { amount: 99999.99, participants: [ME, OTHER] }, { splitType: "SHARES", amount: 10, splits: { [ME]: 1, [OTHER]: 2 } }, { splitType: "PERCENTAGE", amount: 33.33, splits: { [ME]: 33.33, [OTHER]: 66.67 } }]) {
      p.expense.create.mockClear();
      expect((await post(body(over))).status).toBe(201);
      const { data } = p.expense.create.mock.calls[0][0];
      expect(data.splits.create.reduce((s: number, x: { amount: number }) => s + x.amount, 0), JSON.stringify(over)).toBe(data.amount);
    }
  });

  it("two identical requests racing: the loser gets the winner's expense (200), not an error", async () => {
    asMember();
    p.expense.findUnique.mockResolvedValue(null);
    p.expense.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    p.expense.findFirst.mockResolvedValue({ id: CID, description: "Dinner" });
    const res = await post(body({ clientId: CID }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(CID);
  });

  it("a duplicate-key error without a clientId is reported as a conflict, not a crash", async () => {
    asMember();
    p.expense.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    expect((await post(body())).status).toBe(409);
  });

  it("if notifying people fails AFTER the expense was saved, the caller still gets success (so they never re-enter it)", async () => {
    asMember();
    p.expense.create.mockResolvedValue({ id: "e1", paidBy: { name: "Me" } });
    p.notification.createMany.mockRejectedValue(new Error("db hiccup"));
    p.activity.create.mockRejectedValue(new Error("db hiccup"));
    const res = await post(body());
    expect(res.status).toBe(201);
    expect((await res.json()).data.id).toBe("e1");
  });

  it("a genuine server failure while saving is a 500 (so the client knows it did not save)", async () => {
    asMember();
    p.expense.create.mockRejectedValue(new Error("connection lost"));
    expect((await post(body())).status).toBe(500);
  });
});

describe("POST /api/expenses — yen has no fractional amounts", () => {
  const asMember = () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
    p.expense.create.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "e", paidBy: { name: "Me" }, saved: data }));
  };

  it("¥1,000 split two ways saves ¥500 each", async () => {
    asMember();
    expect((await post(body({ currency: "JPY", amount: 1000 }))).status).toBe(201);
    const { data } = p.expense.create.mock.calls[0][0];
    expect(data.amount).toBe(100000);
    expect(data.splits.create.map((s: { amount: number }) => s.amount)).toEqual([50000, 50000]);
  });

  it("an odd yen total is split in whole yen (¥1,001 → ¥501 + ¥500)", async () => {
    asMember();
    expect((await post(body({ currency: "JPY", amount: 1001 }))).status).toBe(201);
    expect(p.expense.create.mock.calls[0][0].data.splits.create.map((s: { amount: number }) => s.amount)).toEqual([50100, 50000]);
  });

  it("¥100.50 is refused (400) and nothing is saved", async () => {
    asMember();
    const res = await post(body({ currency: "JPY", amount: 100.5 }));
    expect(res.status).toBe(400);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("a multi-payer yen expense with fractional payer amounts is refused", async () => {
    asMember();
    const res = await post(body({ currency: "JPY", amount: 1000, payers: [{ userId: ME, amount: 500.5 }, { userId: OTHER, amount: 499.5 }] }));
    expect(res.status).toBe(400);
  });

  it("the same amount in rupees is fine with paise", async () => {
    asMember();
    expect((await post(body({ currency: "INR", amount: 100.5 }))).status).toBe(201);
  });
});
