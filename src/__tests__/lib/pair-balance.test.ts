import { describe, it, expect } from "vitest";
import { computePairBalances } from "@/lib/pair-balance";

const e = (paidById: string, currency: string, splits: [string, number][]) => ({
  paidById, currency, splits: splits.map(([userId, amount]) => ({ userId, amount })),
});

describe("computePairBalances", () => {
  it("is empty when nothing is shared", () => {
    expect(computePairBalances("me", "f", [], [])).toEqual([]);
  });

  it("positive when the friend owes me, negative when I owe them", () => {
    expect(computePairBalances("me", "f", [e("me", "INR", [["me", 500], ["f", 500]])], [])).toEqual([{ currency: "INR", net: 500 }]);
    expect(computePairBalances("me", "f", [e("f", "INR", [["me", 300], ["f", 300]])], [])).toEqual([{ currency: "INR", net: -300 }]);
  });

  it("nets both directions and settlements", () => {
    const balances = computePairBalances(
      "me", "f",
      [e("me", "INR", [["f", 1000]]), e("f", "INR", [["me", 400]])],
      [{ fromUserId: "f", toUserId: "me", amount: 200, currency: "INR" }]
    );
    expect(balances).toEqual([{ currency: "INR", net: 400 }]); // 1000 - 400 - 200
  });

  it("drops balances that are exactly settled", () => {
    const balances = computePairBalances("me", "f", [e("me", "INR", [["f", 500]])], [{ fromUserId: "f", toUserId: "me", amount: 500, currency: "INR" }]);
    expect(balances).toEqual([]);
  });

  it("keeps currencies apart and orders by size", () => {
    const balances = computePairBalances("me", "f", [e("me", "USD", [["f", 100]]), e("f", "INR", [["me", 9000]])], []);
    expect(balances).toEqual([{ currency: "INR", net: -9000 }, { currency: "USD", net: 100 }]);
  });

  it("ignores expenses and payments involving other people", () => {
    const balances = computePairBalances("me", "f", [e("x", "INR", [["me", 100], ["f", 100]])], [{ fromUserId: "x", toUserId: "me", amount: 50, currency: "INR" }]);
    expect(balances).toEqual([]);
  });
});
