import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET as CRON } from "@/app/api/cron/process-recurring/route";
import { GET as EXPORT } from "@/app/api/export/route";
import { GET as BALANCES } from "@/app/api/balances/route";
import { GET as BALANCE } from "@/app/api/balance/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
});
afterEach(() => vi.unstubAllEnvs());

describe("cron /api/cron/process-recurring", () => {
  const call = (auth?: string) =>
    CRON(new NextRequest("http://x/api/cron/process-recurring", { headers: auth ? { authorization: auth } : {} }));

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
    expect(p.expense.findMany).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret and accepts the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call("Bearer nope")).status).toBe(401);
    p.expense.findMany.mockResolvedValue([]);
    const ok = await call("Bearer s3cret");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, created: 0 });
  });

  it("catches up every missed occurrence in one run", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const start = new Date(); start.setDate(start.getDate() - 3); // daily expense, 3 days overdue
    p.expense.findMany.mockResolvedValue([{
      id: "root", recurringInterval: "DAILY", date: start, lastRecurredAt: null, groupId: null,
      description: "Milk", amount: 5000, currency: "INR", category: "FOOD", splitType: "EQUAL",
      paidById: ME, notes: null, payers: [], splits: [{ userId: ME, amount: 5000, percentage: null, shares: null }],
    }]);
    p.expense.findFirst.mockResolvedValue(null);
    p.expense.create.mockImplementation(async () => ({ id: `c${p.expense.create.mock.calls.length}` }));
    p.expense.update.mockResolvedValue({});
    const res = await call("Bearer s3cret");
    expect((await res.json()).created).toBe(3);
    expect(p.expense.create).toHaveBeenCalledTimes(3);
  });
});

describe("GET /api/export — CSV safety", () => {
  it("neutralises spreadsheet formulas and includes a currency column", async () => {
    p.expense.findMany.mockResolvedValue([{
      date: new Date("2026-02-01"), description: '=HYPERLINK("http://evil")', category: "FOOD", currency: "INR",
      amount: 12345, paidBy: { name: "+Bob" }, payers: [], splits: [{ userId: ME, amount: 12345 }], group: null, splitType: "EQUAL",
    }]);
    const res = await EXPORT(new NextRequest("http://x/api/export"));
    const csv = await res.text();
    expect(csv.split("\n")[0]).toContain('"Currency"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain(`"'+Bob"`);
    expect(csv).toContain('"INR","123.45"');
  });

  it("exports expenses the user paid even when not in the split", async () => {
    p.expense.findMany.mockResolvedValue([]);
    await EXPORT(new NextRequest("http://x/api/export"));
    expect(p.expense.findMany.mock.calls[0][0].where.AND[0].OR).toContainEqual({ paidById: ME });
  });
});

describe("GET /api/export — filters", () => {
  it("exports exactly what the list shows (same search/category/date/group filters)", async () => {
    p.expense.findMany.mockResolvedValue([]);
    await EXPORT(new NextRequest("http://x/api/export?q=goa&category=FOOD&from=2026-01-01&to=2026-01-31&groupId=g1"));
    const and = p.expense.findMany.mock.calls[0][0].where.AND;
    expect(and[0].OR).toBeDefined(); // visibility
    expect(and[1].AND).toEqual(expect.arrayContaining([
      { groupId: "g1" }, { category: "FOOD" },
      { date: { gte: new Date("2026-01-01T00:00:00.000Z") } },
      { date: { lte: new Date("2026-01-31T23:59:59.999Z") } },
    ]));
  });

  it("still exports everything when no filter is given", async () => {
    p.expense.findMany.mockResolvedValue([]);
    await EXPORT(new NextRequest("http://x/api/export"));
    expect(p.expense.findMany.mock.calls[0][0].where.AND[1]).toEqual({});
  });
});

describe("balances are tracked per currency", () => {
  const split = (userId: string, amount: number) => ({ userId, amount });
  const settle = (fromUserId: string, toUserId: string, amount: number, currency: string) => ({ fromUserId, toUserId, amount, currency, groupId: null });

  it("/api/balances keeps INR and USD apart for the same person", async () => {
    p.expense.findMany.mockResolvedValue([ // I paid, OTHER owes me
      { id: "1", paidById: ME, currency: "INR", amount: 100000, groupId: null, payers: [], splits: [split(ME, 50000), split(OTHER, 50000)] },
      { id: "2", paidById: ME, currency: "USD", amount: 2000, groupId: null, payers: [], splits: [split(ME, 1000), split(OTHER, 1000)] },
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null }]);
    const { data } = await (await BALANCES()).json();
    const pal = data.byPerson[OTHER];
    expect(pal.all).toEqual([{ currency: "INR", net: 50000 }, { currency: "USD", net: 1000 }]);
    expect(pal.currency).toBe("INR"); // headline = largest absolute amount
  });

  it("/api/balances nets a settlement only against its own currency", async () => {
    p.expense.findMany.mockResolvedValue([
      { id: "1", paidById: ME, currency: "USD", amount: 2000, groupId: null, payers: [], splits: [split(ME, 1000), split(OTHER, 1000)] },
    ]);
    p.settlement.findMany.mockResolvedValue([settle(OTHER, ME, 1000, "INR")]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null }]);
    const { data } = await (await BALANCES()).json();
    const all = data.byPerson[OTHER].all;
    expect(all).toContainEqual({ currency: "USD", net: 1000 }); // INR payment must not cancel a USD debt
    expect(all).toContainEqual({ currency: "INR", net: -1000 });
  });

  it("/api/balances handles multiple payers and drops settled-up people", async () => {
    const THIRD = "66666666-6666-4666-8666-666666666666";
    p.expense.findMany.mockResolvedValue([
      // ME paid 600, OTHER paid 300; split 3 ways equally → THIRD owes ME 300, OTHER is square with ME
      { id: "1", paidById: ME, currency: "INR", amount: 900, groupId: null,
        payers: [{ userId: ME, amount: 600 }, { userId: OTHER, amount: 300 }],
        splits: [split(ME, 300), split(OTHER, 300), split(THIRD, 300)] },
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: THIRD, name: "Third", avatarUrl: null }]);
    const { data } = await (await BALANCES()).json();
    expect(data.byPerson[THIRD].all).toEqual([{ currency: "INR", net: 300 }]);
    expect(data.byPerson[OTHER]).toBeUndefined();
  });

  it("/api/balances reports per-group balances", async () => {
    const G = "44444444-4444-4444-8444-444444444444";
    p.expense.findMany.mockResolvedValue([
      { id: "1", paidById: ME, currency: "INR", amount: 1000, groupId: G, payers: [], splits: [split(ME, 500), split(OTHER, 500)] },
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null }]);
    const { data } = await (await BALANCES()).json();
    expect(data.byGroup[G]).toMatchObject({ net: 500, currency: "INR" });
  });

  it("/api/balance includes the payee's saved UPI ID so the app can offer one-tap payment", async () => {
    p.expense.findMany.mockResolvedValue([
      { id: "u", paidById: OTHER, currency: "INR", amount: 1000, groupId: null, payers: [], splits: [{ userId: ME, amount: 500 }, { userId: OTHER, amount: 500 }] },
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null, upiId: "pal@ybl" }]);
    const { data } = await BALANCE().then((r) => r.json());
    expect(data.simplified[0]).toMatchObject({ fromUserId: ME, toUserId: OTHER, currency: "INR", toUser: { upiId: "pal@ybl" } });
  });

  it("/api/balance simplifies each currency separately and labels every payment", async () => {
    p.expense.findMany.mockResolvedValue([
      { paidById: ME, currency: "INR", amount: 1000, groupId: null, payers: [], splits: [{ userId: ME, amount: 500 }, { userId: OTHER, amount: 500 }] },
      { paidById: OTHER, currency: "USD", amount: 600, groupId: null, payers: [], splits: [{ userId: ME, amount: 300 }, { userId: OTHER, amount: 300 }] },
    ]);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null }]);
    const { data } = await (await BALANCE()).json();
    expect(data.simplified).toHaveLength(2);
    const inr = data.simplified.find((d: { currency: string }) => d.currency === "INR");
    const usd = data.simplified.find((d: { currency: string }) => d.currency === "USD");
    expect(inr).toMatchObject({ fromUserId: OTHER, toUserId: ME, amount: 500 });
    expect(usd).toMatchObject({ fromUserId: ME, toUserId: OTHER, amount: 300 });
  });
});
