import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});
const getRates = vi.fn();
vi.mock("@/lib/rates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rates")>("@/lib/rates");
  return { ...actual, getRates: (b: string) => getRates(b) };
});

import { GET } from "@/app/api/dashboard/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const day = new Date();

type Row = { amount: number; currency: string; date?: Date };
/** An expense ME paid where OTHER owes `amount` (ME's own share is 0 for simplicity). */
const owed = ({ amount, currency, date = day }: Row) => ({
  id: `o${Math.random()}`, paidById: ME, currency, amount, groupId: null, date, payers: [], splits: [{ userId: OTHER, amount }],
});
/** An expense OTHER paid where ME owes `amount`. */
const owing = ({ amount, currency, date = day }: Row) => ({
  id: `w${Math.random()}`, paidById: OTHER, currency, amount, groupId: null, date, payers: [], splits: [{ userId: ME, amount }],
});

function seed({ expenses = [] as unknown[], settlements = [] as unknown[] }) {
  p.user.findUnique.mockResolvedValue({ currency: "INR" });
  p.expense.findMany.mockResolvedValue(expenses);
  p.settlement.findMany.mockResolvedValue(settlements);
  p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Pal", avatarUrl: null }]);
  p.group.count.mockResolvedValue(1);
  p.activity.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  resetPrisma();
  getRates.mockReset();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.upsert.mockResolvedValue({});
  p.user.findUnique.mockResolvedValue({ currency: "INR" });
});

describe("GET /api/dashboard", () => {
  it("totals only the primary currency in the headline and lists the rest separately", async () => {
    seed({ expenses: [owed({ amount: 100000, currency: "INR" }), owed({ amount: 5000, currency: "USD" })] });
    getRates.mockResolvedValue(null);
    const { data } = await (await GET()).json();
    expect(data.currency).toBe("INR");
    expect(data.stats.totalOwed).toBe(100000);
    expect(data.stats.otherCurrencies).toEqual([{ currency: "USD", owed: 5000, owing: 0 }]);
    expect(data.stats.combined).toBeNull(); // rates unavailable → no estimate, no crash
  });

  it("adds an approximate combined total when live rates are available", async () => {
    seed({ expenses: [owed({ amount: 100000, currency: "INR" }), owed({ amount: 1000, currency: "USD" })] });
    getRates.mockResolvedValue({ base: "INR", date: "2026-10-01", rates: { USD: 0.0125 } }); // $10 = ₹800
    const { data } = await (await GET()).json();
    expect(getRates).toHaveBeenCalledWith("INR");
    expect(data.stats.combined).toMatchObject({ owed: 180000, owing: 0, net: 180000, complete: true, date: "2026-10-01" });
  });

  it("flags the estimate as incomplete when a currency has no rate", async () => {
    seed({ expenses: [owed({ amount: 100000, currency: "INR" }), owed({ amount: 1000, currency: "EUR" })] });
    getRates.mockResolvedValue({ base: "INR", date: "d", rates: { USD: 0.0125 } });
    const { data } = await (await GET()).json();
    expect(data.stats.combined).toMatchObject({ owed: 100000, complete: false });
  });

  it("does not call the rate service when everything is in one currency", async () => {
    seed({ expenses: [owed({ amount: 100000, currency: "INR" })] });
    const { data } = await (await GET()).json();
    expect(getRates).not.toHaveBeenCalled();
    expect(data.stats.combined).toBeNull();
  });

  it("counts old debts: totals are all-time, not limited to six months", async () => {
    seed({ expenses: [owed({ amount: 7000, currency: "INR", date: new Date("2020-01-01") })] });
    const { data } = await (await GET()).json();
    expect(data.stats.totalOwed).toBe(7000);
    // …but the 6-month chart does not include it
    expect(data.monthly.every((m: { owed: number }) => m.owed === 0)).toBe(true);
  });

  it("nets what you owe against what you're owed, per person, and ranks the biggest first", async () => {
    seed({ expenses: [owed({ amount: 10000, currency: "INR" }), owing({ amount: 4000, currency: "INR" })] });
    const { data } = await (await GET()).json();
    expect(data.stats).toMatchObject({ totalOwed: 6000, totalOwing: 0, netBalance: 6000 });
    expect(data.personBalances).toEqual([expect.objectContaining({ id: OTHER, net: 6000, currency: "INR", name: "Pal" })]);
  });

  it("applies settlements, and the monthly chart counts only expense debts from this month", async () => {
    seed({
      expenses: [owed({ amount: 10000, currency: "INR" })],
      settlements: [{ fromUserId: OTHER, toUserId: ME, amount: 10000, currency: "INR", groupId: null }],
    });
    const { data } = await (await GET()).json();
    expect(data.stats.totalOwed).toBe(0); // fully paid back
    const thisMonth = data.monthly[data.monthly.length - 1];
    expect(thisMonth.owed).toBe(100); // the chart still shows the ₹100 expense, not the repayment
  });

  it("handles multi-payer expenses (the other payer covered part of it)", async () => {
    seed({
      expenses: [{
        id: "m", paidById: ME, currency: "INR", amount: 900, groupId: null, date: day,
        payers: [{ userId: ME, amount: 600 }, { userId: OTHER, amount: 300 }],
        splits: [{ userId: ME, amount: 300 }, { userId: OTHER, amount: 300 }, { userId: "77777777-7777-4777-8777-777777777777", amount: 300 }],
      }],
    });
    p.user.findMany.mockResolvedValue([{ id: "77777777-7777-4777-8777-777777777777", name: "Third", avatarUrl: null }]);
    const { data } = await (await GET()).json();
    expect(data.stats.totalOwed).toBe(300); // only Third owes me; Pal is square
    expect(data.personBalances).toHaveLength(1);
  });

  it("the headline currency is the user's home currency, NOT whatever their latest group uses (regression)", async () => {
    seed({ expenses: [owed({ amount: 100000, currency: "USD" })] });
    p.user.findUnique.mockResolvedValue({ currency: "USD" });
    p.group.findFirst.mockResolvedValue({ currency: "INR" }); // an INR group exists, but must not override the setting
    getRates.mockResolvedValue(null);
    const { data } = await (await GET()).json();
    expect(data.currency).toBe("USD");
    expect(data.stats.totalOwed).toBe(100000);
    expect(data.stats.otherCurrencies).toEqual([]);
    expect(p.group.findFirst).not.toHaveBeenCalled(); // the group lookup is gone entirely
  });

  it("falls back to INR when the profile has no currency yet", async () => {
    seed({ expenses: [] });
    p.user.findUnique.mockResolvedValue(null);
    const { data } = await (await GET()).json();
    expect(data.currency).toBe("INR");
  });
});
