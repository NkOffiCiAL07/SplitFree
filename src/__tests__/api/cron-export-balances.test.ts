import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
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
      paidById: ME, notes: null, splits: [{ userId: ME, amount: 5000, percentage: null, shares: null }],
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
      amount: 12345, paidBy: { name: "+Bob" }, splits: [{ userId: ME, amount: 12345 }], group: null, splitType: "EQUAL",
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
    expect(p.expense.findMany.mock.calls[0][0].where.OR).toContainEqual({ paidById: ME });
  });
});

describe("balances are tracked per currency", () => {
  it("/api/balances keeps INR and USD apart for the same person", async () => {
    p.expenseSplit.findMany
      .mockResolvedValueOnce([ // I paid, OTHER owes me
        { amount: 50000, userId: OTHER, expense: { groupId: null, currency: "INR" }, user: { id: OTHER, name: "Pal", avatarUrl: null } },
        { amount: 1000, userId: OTHER, expense: { groupId: null, currency: "USD" }, user: { id: OTHER, name: "Pal", avatarUrl: null } },
      ])
      .mockResolvedValueOnce([]);
    p.settlement.findMany.mockResolvedValue([]);
    const { data } = await (await BALANCES()).json();
    const pal = data.byPerson[OTHER];
    expect(pal.all).toEqual([{ currency: "INR", net: 50000 }, { currency: "USD", net: 1000 }]);
    expect(pal.currency).toBe("INR"); // headline = largest absolute amount
  });

  it("/api/balances nets a settlement only against its own currency", async () => {
    p.expenseSplit.findMany
      .mockResolvedValueOnce([{ amount: 1000, userId: OTHER, expense: { groupId: null, currency: "USD" }, user: { id: OTHER, name: "Pal", avatarUrl: null } }])
      .mockResolvedValueOnce([]);
    p.settlement.findMany.mockResolvedValue([
      { fromUserId: OTHER, toUserId: ME, amount: 1000, groupId: null, currency: "INR", fromUser: { name: "Pal", avatarUrl: null }, toUser: { name: "Me", avatarUrl: null } },
    ]);
    const { data } = await (await BALANCES()).json();
    const all = data.byPerson[OTHER].all;
    expect(all).toContainEqual({ currency: "USD", net: 1000 }); // INR payment must not cancel a USD debt
    expect(all).toContainEqual({ currency: "INR", net: -1000 });
  });

  it("/api/balance simplifies each currency separately and labels every payment", async () => {
    p.expense.findMany.mockResolvedValue([
      { paidById: ME, currency: "INR", splits: [{ userId: ME, amount: 500 }, { userId: OTHER, amount: 500 }] },
      { paidById: OTHER, currency: "USD", splits: [{ userId: ME, amount: 300 }, { userId: OTHER, amount: 300 }] },
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
