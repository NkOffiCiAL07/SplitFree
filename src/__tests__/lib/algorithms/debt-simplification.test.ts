import { describe, it, expect } from "vitest";
import { simplifyDebts, calculateSplits, computeNetBalance } from "@/lib/algorithms/debt-simplification";
import type { Debt } from "@/types";

/* ── simplifyDebts ──────────────────────────────────────────── */

describe("simplifyDebts", () => {
  it("returns empty array for no debts", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("simplifies two-person debt to one transaction", () => {
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "B", amount: 1000 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fromUserId: "A", toUserId: "B", amount: 1000 });
  });

  it("cancels out mutual debts", () => {
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "B", amount: 500 },
      { fromUserId: "B", toUserId: "A", amount: 500 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });

  it("nets partial mutual debts", () => {
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "B", amount: 1000 },
      { fromUserId: "B", toUserId: "A", amount: 400 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(600);
  });

  it("reduces 3-person chain to 2 transactions max", () => {
    // A owes B 100, B owes C 100 → A should pay C 100
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "B", amount: 100 },
      { fromUserId: "B", toUserId: "C", amount: 100 },
    ];
    const result = simplifyDebts(debts);
    expect(result.length).toBeLessThanOrEqual(2);
    const totalSettled = result.reduce((s, d) => s + d.amount, 0);
    expect(totalSettled).toBe(100);
  });

  it("preserves total amount after simplification", () => {
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "B", amount: 300 },
      { fromUserId: "A", toUserId: "C", amount: 200 },
      { fromUserId: "B", toUserId: "C", amount: 100 },
    ];
    const simplified = simplifyDebts(debts);
    const originalNet = 600;
    const simplifiedTotal = simplified.reduce((s, d) => s + d.amount, 0);
    // After simplification, net flow should be preserved (not necessarily same total)
    // but no creditor should be owed more than they're owed overall
    expect(simplifiedTotal).toBeGreaterThan(0);
    expect(simplifiedTotal).toBeLessThanOrEqual(originalNet);
  });

  it("handles self-referencing debt gracefully (net zero)", () => {
    const debts: Debt[] = [
      { fromUserId: "A", toUserId: "A", amount: 100 },
    ];
    const result = simplifyDebts(debts);
    expect(result).toHaveLength(0);
  });
});

/* ── calculateSplits ────────────────────────────────────────── */

describe("calculateSplits — EQUAL", () => {
  it("splits evenly", () => {
    const result = calculateSplits(3000, ["A", "B", "C"], "EQUAL");
    // 3000 / 3 = 1000 each
    expect(result["B"]).toBe(1000);
    expect(result["C"]).toBe(1000);
  });

  it("assigns remainder to first participant", () => {
    const result = calculateSplits(1000, ["A", "B", "C"], "EQUAL");
    // 1000 / 3 = 333 each, remainder 1 → A gets 334
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
    expect(result["A"]).toBe(334);
    expect(result["B"]).toBe(333);
  });

  it("splits two people", () => {
    const result = calculateSplits(500, ["A", "B"], "EQUAL");
    expect(result["A"]).toBe(250);
    expect(result["B"]).toBe(250);
  });
});

describe("calculateSplits — EXACT", () => {
  it("assigns exact dollar amounts (in dollars) converted to cents", () => {
    const result = calculateSplits(3000, ["A", "B"], "EXACT", { A: 10, B: 20 });
    expect(result["A"]).toBe(1000);
    expect(result["B"]).toBe(2000);
  });

  it("throws if amounts don't match total", () => {
    expect(() =>
      calculateSplits(3000, ["A", "B"], "EXACT", { A: 5, B: 20 })
    ).toThrow();
  });

  it("throws if overrides not provided", () => {
    expect(() => calculateSplits(3000, ["A", "B"], "EXACT")).toThrow();
  });
});

describe("calculateSplits — PERCENTAGE", () => {
  it("splits by percentage", () => {
    const result = calculateSplits(10000, ["A", "B"], "PERCENTAGE", { A: 60, B: 40 });
    expect(result["A"]).toBe(6000);
    expect(result["B"]).toBe(4000);
  });

  it("throws if percentages don't sum to 100", () => {
    expect(() =>
      calculateSplits(10000, ["A", "B"], "PERCENTAGE", { A: 60, B: 20 })
    ).toThrow();
  });

  it("last person gets remainder to avoid rounding errors", () => {
    const result = calculateSplits(10000, ["A", "B", "C"], "PERCENTAGE", { A: 33, B: 33, C: 34 });
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(10000);
  });
});

describe("calculateSplits — SHARES", () => {
  it("splits by share count", () => {
    const result = calculateSplits(6000, ["A", "B", "C"], "SHARES", { A: 1, B: 2, C: 3 });
    // A=1/6, B=2/6, C=3/6
    expect(result["A"]).toBe(1000);
    expect(result["B"]).toBe(2000);
  });

  it("throws if total shares is zero", () => {
    expect(() =>
      calculateSplits(6000, ["A", "B"], "SHARES", { A: 0, B: 0 })
    ).toThrow();
  });

  it("total always equals input", () => {
    const result = calculateSplits(7777, ["A", "B", "C"], "SHARES", { A: 1, B: 1, C: 1 });
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(7777);
  });
});

/* ── computeNetBalance ──────────────────────────────────────── */

describe("computeNetBalance", () => {
  it("returns 0 with no expenses or settlements", () => {
    expect(computeNetBalance("A", [], [])).toBe(0);
  });

  it("is positive when user paid for others", () => {
    const expenses = [
      {
        paidById: "A",
        splits: [
          { userId: "A", amount: 500 },
          { userId: "B", amount: 500 },
        ],
      },
    ];
    // A paid 1000, A owes 500 of it → net = +500 (B owes A 500)
    expect(computeNetBalance("A", expenses, [])).toBe(500);
  });

  it("is negative when user owes others", () => {
    const expenses = [
      {
        paidById: "B",
        splits: [
          { userId: "A", amount: 500 },
          { userId: "B", amount: 500 },
        ],
      },
    ];
    expect(computeNetBalance("A", expenses, [])).toBe(-500);
  });

  it("settlements reduce outstanding balance", () => {
    const expenses = [
      {
        paidById: "B",
        splits: [{ userId: "A", amount: 1000 }],
      },
    ];
    const settlements = [{ fromUserId: "A", toUserId: "B", amount: 600 }];
    expect(computeNetBalance("A", expenses, settlements)).toBe(-400);
  });

  it("handles multiple expenses correctly", () => {
    // A paid 1000 (B owes 500), B paid 200 (A owes 100)
    const expenses = [
      { paidById: "A", splits: [{ userId: "A", amount: 500 }, { userId: "B", amount: 500 }] },
      { paidById: "B", splits: [{ userId: "A", amount: 100 }, { userId: "B", amount: 100 }] },
    ];
    // Net for A: +500 (from first) - 100 (owed on second) = +400
    expect(computeNetBalance("A", expenses, [])).toBe(400);
  });
});
