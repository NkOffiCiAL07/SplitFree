import { describe, it, expect } from "vitest";
import { computeGroupStats, type StatsExpense } from "@/lib/group-stats";

const exp = (over: Partial<StatsExpense> & { splits: StatsExpense["splits"] }): StatsExpense => ({
  amount: 0, currency: "INR", category: "FOOD", paidById: "a", ...over,
});

describe("computeGroupStats", () => {
  it("returns zeros for an empty group", () => {
    const s = computeGroupStats([], "a");
    expect(s).toMatchObject({ currency: "INR", total: 0, yourShare: 0, yourPaid: 0, expenseCount: 0 });
    expect(s.byCategory).toEqual([]);
  });

  it("totals spend, your share and what you paid", () => {
    const s = computeGroupStats([
      exp({ amount: 3000, paidById: "a", splits: [{ userId: "a", amount: 1000 }, { userId: "b", amount: 1000 }, { userId: "c", amount: 1000 }] }),
      exp({ amount: 600, paidById: "b", category: "TRANSPORT", splits: [{ userId: "a", amount: 300 }, { userId: "b", amount: 300 }] }),
    ], "a");
    expect(s.total).toBe(3600);
    expect(s.yourShare).toBe(1300);
    expect(s.yourPaid).toBe(3000);
    expect(s.expenseCount).toBe(2);
  });

  it("breaks spending down by category (largest first) and by member", () => {
    const s = computeGroupStats([
      exp({ amount: 500, category: "FOOD", paidById: "a", splits: [{ userId: "a", amount: 500 }] }),
      exp({ amount: 900, category: "TRAVEL", paidById: "b", splits: [{ userId: "b", amount: 900 }] }),
    ], "a");
    expect(s.byCategory).toEqual([{ category: "TRAVEL", total: 900 }, { category: "FOOD", total: 500 }]);
    expect(s.byMember[0]).toEqual({ userId: "b", paid: 900, share: 900 });
  });

  it("never mixes currencies: details the dominant one and lists the rest", () => {
    const s = computeGroupStats([
      exp({ amount: 10000, currency: "INR", splits: [{ userId: "a", amount: 10000 }] }),
      exp({ amount: 500, currency: "USD", splits: [{ userId: "a", amount: 500 }] }),
    ], "a");
    expect(s.currency).toBe("INR");
    expect(s.total).toBe(10000);
    expect(s.yourShare).toBe(10000);
    expect(s.otherCurrencies).toEqual([{ currency: "USD", total: 500 }]);
  });
});
