import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { subMonths } from "date-fns";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});
const getRates = vi.fn();
vi.mock("@/lib/rates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rates")>("@/lib/rates");
  return { ...actual, getRates: (...a: unknown[]) => (getRates as (...x: unknown[]) => unknown)(...a) };
});

import { GET as ANALYTICS } from "@/app/api/analytics/route";
import { GET as BALANCES } from "@/app/api/balances/route";
import { GET as GROUP_GET } from "@/app/api/groups/[id]/route";
import { GET as BUDGET } from "@/app/api/groups/[id]/budget/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const RATES = { base: "INR", date: "2026-10-01", rates: { USD: 0.0125, EUR: 0.0115, JPY: 1.8 } }; // $10 = ₹800
const ctx = { params: Promise.resolve({ id: GROUP }) };
const here = () => { const d = subMonths(new Date(), 0); d.setDate(15); return d; };

beforeEach(() => {
  resetPrisma();
  getRates.mockReset();
  getRates.mockResolvedValue(RATES);
  authState.user = { id: ME, email: "me@example.com" };
  p.user.findUnique.mockResolvedValue({ currency: "INR" });
});

describe("analytics — spending in every currency, expressed in the home currency", () => {
  const myExp = (amount: number, currency: string, category = "FOOD") => ({ id: Math.random(), category, currency, date: here(), splits: [{ userId: ME, amount }] });
  const seed = (expenses: unknown[], ledger: unknown[] = []) => {
    p.expense.findMany.mockResolvedValueOnce(expenses).mockResolvedValueOnce(ledger);
    p.settlement.findMany.mockResolvedValue([]);
    p.group.findMany.mockResolvedValue([]);
  };
  const get = async () => (await ANALYTICS()).json().then((j) => j.data);

  it("converts dollars into rupees instead of dropping them, and says it is approximate", async () => {
    seed([myExp(100000, "INR"), myExp(1000, "USD", "TRAVEL")]);
    const d = await get();
    expect(d.totalExpenses).toBe(180000);
    expect(d.categoryTotals).toEqual({ FOOD: 100000, TRAVEL: 80000 });
    expect(d.monthly[5].total).toBe(180000);
    expect(d).toMatchObject({ approximate: true, rateDate: "2026-10-01", skipped: [] });
  });

  it("is exact (not 'approximate') and asks for no rates when everything is in the home currency", async () => {
    seed([myExp(100000, "INR")]);
    const d = await get();
    expect(d.approximate).toBe(false);
    expect(getRates).not.toHaveBeenCalled();
  });

  it("works in any home currency (yen home, rupee and dollar spending → whole yen)", async () => {
    p.user.findUnique.mockResolvedValue({ currency: "JPY" });
    getRates.mockResolvedValue({ base: "JPY", date: "d", rates: { INR: 0.55, USD: 0.0067 } });
    seed([myExp(12345, "INR"), myExp(999, "USD")]);
    const d = await get();
    expect(d.currency).toBe("JPY");
    expect(d.totalExpenses % 100).toBe(0);
    expect(d.totalExpenses).toBeGreaterThan(0);
  });

  it("with no exchange rates it never mixes: foreign spending is listed as skipped, home spending still counts", async () => {
    getRates.mockResolvedValue(null);
    seed([myExp(100000, "INR"), myExp(1000, "USD"), myExp(500, "USD"), myExp(70, "EUR")]);
    const d = await get();
    expect(d.totalExpenses).toBe(100000);
    expect(d.skipped).toEqual(expect.arrayContaining([{ currency: "USD", amount: 1500 }, { currency: "EUR", amount: 70 }]));
    expect(d.approximate).toBe(false);
  });

  it("a currency missing from the rate table is reported, the others still convert", async () => {
    getRates.mockResolvedValue({ base: "INR", date: "d", rates: { USD: 0.0125 } });
    seed([myExp(1000, "USD"), myExp(300, "EUR")]);
    const d = await get();
    expect(d.totalExpenses).toBe(80000);
    expect(d.skipped).toEqual([{ currency: "EUR", amount: 300 }]);
  });

  it("owed / owing are converted per currency from the ledger (a person's dollars net before converting)", async () => {
    seed([], [
      { id: "1", paidById: ME, currency: "INR", amount: 1000, groupId: null, payers: [], splits: [{ userId: OTHER, amount: 1000 }] },
      { id: "2", paidById: ME, currency: "USD", amount: 1000, groupId: null, payers: [], splits: [{ userId: OTHER, amount: 1000 }] },
      { id: "3", paidById: STRANGER, currency: "EUR", amount: 500, groupId: null, payers: [], splits: [{ userId: ME, amount: 500 }] },
    ]);
    const d = await get();
    expect(d.totalOwed).toBe(1000 + 80000); // ₹10 + $10
    expect(d.totalOwing).toBe(Math.round(500 / 0.0115)); // €5
    expect(d.approximate).toBe(true);
  });

  it("a rate service that hangs can't hold the page up (bounded wait)", async () => {
    getRates.mockResolvedValue(null);
    seed([myExp(1000, "USD")]);
    await get();
    expect(getRates).toHaveBeenCalledWith("INR", { timeoutMs: 800 });
  });
});

describe("balances — per-currency exactly, plus one overall figure in the home currency", () => {
  const e = (paidById: string, userId: string, amount: number, currency: string) => ({
    id: `${Math.random()}`, paidById, currency, amount, groupId: GROUP, date: new Date(), payers: [], splits: [{ userId, amount }],
  });
  const seed = (expenses: unknown[]) => {
    p.expense.findMany.mockResolvedValue(expenses);
    p.settlement.findMany.mockResolvedValue([]);
    p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Asha", avatarUrl: null }]);
  };
  const get = async () => (await BALANCES()).json().then((j) => j.data);

  it("keeps each currency's debt exact and adds an approximate overall figure", async () => {
    seed([e(ME, OTHER, 50000, "INR"), e(OTHER, ME, 1000, "USD")]); // Asha owes ₹500; I owe $10 (=₹800)
    const d = await get();
    const asha = d.byPerson[OTHER];
    expect(asha.all).toEqual(expect.arrayContaining([{ currency: "INR", net: 50000 }, { currency: "USD", net: -1000 }]));
    expect(asha.inHome).toEqual({ currency: "INR", net: 50000 - 80000, complete: true, approximate: true });
    expect(d.byGroup[GROUP].inHome.net).toBe(-30000);
  });

  it("the headline of a mixed balance is the biggest in home-currency terms, not the biggest raw number", async () => {
    // 5,000 yen-units vs 2,000 USD-units: USD is worth far more even though the raw number is smaller
    seed([e(ME, OTHER, 500000, "JPY"), e(ME, OTHER, 200000, "USD")]);
    const d = await get();
    expect(d.byPerson[OTHER].currency).toBe("USD");
  });

  it("no overall figure is claimed when a currency has no rate (complete=false)", async () => {
    getRates.mockResolvedValue({ base: "INR", date: "d", rates: { USD: 0.0125 } });
    seed([e(ME, OTHER, 50000, "INR"), e(ME, OTHER, 700, "EUR")]);
    const d = await get();
    expect(d.byPerson[OTHER].inHome.complete).toBe(false);
  });

  it("single home-currency balances carry no conversion at all", async () => {
    seed([e(ME, OTHER, 50000, "INR")]);
    const d = await get();
    expect(d.byPerson[OTHER].inHome).toBeNull();
    expect(getRates).not.toHaveBeenCalled();
  });
});

describe("group page — spending summary in the viewer's home currency", () => {
  const exp = (over: Record<string, unknown>) => ({ id: "e", paidById: ME, currency: "INR", amount: 900, groupId: GROUP, date: new Date(), category: "FOOD", payers: [], splits: [], ...over });
  const member = (id: string, name: string) => ({ userId: id, role: "MEMBER", joinedAt: new Date(), user: { id, name, avatarUrl: null } });
  const seed = (expenses: unknown[]) => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME, role: "ADMIN" });
    p.group.findUnique.mockResolvedValue({ id: GROUP, name: "Trip", currency: "USD", expenses: [], members: [member(ME, "Me"), member(OTHER, "Asha")] });
    p.expense.findMany.mockResolvedValue(expenses);
    p.settlement.findMany.mockResolvedValue([]);
  };
  const get = async () => (await GROUP_GET(new NextRequest("http://x"), ctx)).json().then((j) => j.data);

  it("converts every expense into the VIEWER's home currency (not the group's)", async () => {
    seed([
      exp({ amount: 100000, currency: "INR", splits: [{ userId: ME, amount: 50000 }, { userId: OTHER, amount: 50000 }] }),
      exp({ amount: 2000, currency: "USD", category: "TRAVEL", splits: [{ userId: ME, amount: 1000 }, { userId: OTHER, amount: 1000 }] }),
    ]);
    const { stats } = await get();
    expect(stats).toMatchObject({ currency: "INR", total: 100000 + 160000, yourShare: 50000 + 80000, approximate: true, rateDate: "2026-10-01", otherCurrencies: [] });
    expect(stats.byCategory).toEqual([{ category: "TRAVEL", total: 160000 }, { category: "FOOD", total: 100000 }]);
  });

  it("member balances stay exact per currency: group-currency balance + the rest listed", async () => {
    seed([
      exp({ paidById: ME, currency: "USD", amount: 2000, splits: [{ userId: ME, amount: 1000 }, { userId: OTHER, amount: 1000 }] }),
      exp({ paidById: ME, currency: "INR", amount: 100000, splits: [{ userId: ME, amount: 50000 }, { userId: OTHER, amount: 50000 }] }),
    ]);
    const { memberBalances } = await get();
    expect(memberBalances).toEqual([expect.objectContaining({ userId: OTHER, balance: 1000, others: [{ currency: "INR", net: 50000 }] })]);
  });

  it("unconvertible spending is listed in its own currency, never dropped", async () => {
    getRates.mockResolvedValue(null);
    seed([
      exp({ amount: 100000, currency: "INR", splits: [{ userId: ME, amount: 100000 }] }),
      exp({ amount: 2000, currency: "EUR", splits: [{ userId: ME, amount: 2000 }] }),
    ]);
    const { stats } = await get();
    expect(stats.total).toBe(100000);
    expect(stats.otherCurrencies).toEqual([{ currency: "EUR", total: 2000 }]);
    expect(stats.approximate).toBe(false);
  });
});

describe("budget — spending in other currencies is converted into the group's currency", () => {
  const split = (amount: number, currency: string, category = "FOOD") => ({ amount, expense: { currency, date: new Date(), category } });
  const seed = (splits: unknown[], groupCurrency = "INR") => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.budget.findMany.mockResolvedValue([{ id: "b", period: "MONTHLY", category: null, amount: 500000 }]);
    p.group.findUnique.mockResolvedValue({ currency: groupCurrency });
    p.expenseSplit.findMany.mockResolvedValue(splits);
  };
  const get = async () => (await BUDGET(new NextRequest("http://x"), ctx)).json().then((j) => j.data);

  it("adds rupees and dollars correctly (the old code added their raw numbers)", async () => {
    seed([split(100000, "INR"), split(1000, "USD")]); // ₹1,000 + $10 (=₹800)
    const d = await get();
    expect(d.budgets[0].spent).toBe(180000);
    expect(d.totalSpentThisMonth).toBe(180000);
    expect(d).toMatchObject({ currency: "INR", approximate: true, skipped: [] });
  });

  it("reports spending it cannot convert instead of ignoring it", async () => {
    getRates.mockResolvedValue(null);
    seed([split(100000, "INR"), split(1000, "USD")]);
    const d = await get();
    expect(d.budgets[0].spent).toBe(100000);
    expect(d.skipped).toEqual([{ currency: "USD", amount: 1000 }]);
  });

  it("no rate lookup when everything is in the group's currency", async () => {
    seed([split(100000, "INR")]);
    const d = await get();
    expect(getRates).not.toHaveBeenCalled();
    expect(d.approximate).toBe(false);
  });
});
