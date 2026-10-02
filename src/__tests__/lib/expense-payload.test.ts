import { describe, it, expect } from "vitest";
import { expenseToCreatePayload } from "@/lib/expense-payload";
import type { Expense } from "@/types";

const base = {
  id: "e1", groupId: "g1", description: "Dinner", amount: 3000, currency: "USD",
  category: "FOOD", paidById: "a", date: new Date("2026-01-01"), isRecurring: false,
  recurringInterval: null, notes: null, receiptUrl: null,
  createdAt: new Date(), updatedAt: new Date(),
} as unknown as Expense;

const split = (userId: string, amount: number, extra = {}) =>
  ({ id: userId, expenseId: "e1", userId, amount, percentage: null, shares: null, isPaid: false, ...extra });

describe("expenseToCreatePayload", () => {
  it("converts cents to dollars and keeps participants for equal splits", () => {
    const p = expenseToCreatePayload({ ...base, splitType: "EQUAL", splits: [split("a", 1500), split("b", 1500)] });
    expect(p.amount).toBe(30);
    expect(p.participants).toEqual(["a", "b"]);
    expect(p).not.toHaveProperty("splits");
  });

  it("restores exact amounts in dollars", () => {
    const p = expenseToCreatePayload({ ...base, splitType: "EXACT", splits: [split("a", 2000), split("b", 1000)] });
    expect(p.splits).toEqual({ a: 20, b: 10 });
  });

  it("restores percentages and shares", () => {
    const pct = expenseToCreatePayload({
      ...base, splitType: "PERCENTAGE",
      splits: [split("a", 2000, { percentage: 70 }), split("b", 1000, { percentage: 30 })],
    });
    expect(pct.splits).toEqual({ a: 70, b: 30 });
    const sh = expenseToCreatePayload({
      ...base, splitType: "SHARES",
      splits: [split("a", 2000, { shares: 2 }), split("b", 1000, { shares: 1 })],
    });
    expect(sh.splits).toEqual({ a: 2, b: 1 });
  });

  it("applies overrides", () => {
    const p = expenseToCreatePayload(
      { ...base, splitType: "EQUAL", splits: [split("a", 3000)] },
      { description: "Dinner (copy)", isRecurring: false }
    );
    expect(p.description).toBe("Dinner (copy)");
  });
});
