import { describe, it, expect } from "vitest";
import { canEditExpense, expenseOwnerId } from "@/lib/expense-permissions";

describe("canEditExpense", () => {
  it("is only true for the person who added the expense", () => {
    expect(canEditExpense({ createdById: "a", paidById: "b" }, "a")).toBe(true);
    expect(canEditExpense({ createdById: "a", paidById: "b" }, "b")).toBe(false);
    expect(canEditExpense({ createdById: "a", paidById: "b" }, "c")).toBe(false);
  });
  it("falls back to the payer when the creator is unknown", () => {
    expect(expenseOwnerId({ createdById: null, paidById: "b" })).toBe("b");
    expect(canEditExpense({ paidById: "b" }, "b")).toBe(true);
    expect(canEditExpense({ paidById: "b" }, "a")).toBe(false);
  });
  it("is false while the user is not known yet", () => {
    expect(canEditExpense({ createdById: "a", paidById: "a" }, undefined)).toBe(false);
  });
});
