import { describe, it, expect } from "vitest";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { createGroupSchema } from "@/lib/validations/group";
import { createExpenseSchema } from "@/lib/validations/expense";

describe("currencies", () => {
  it("lists INR first and defaults to INR", () => {
    expect(CURRENCY_CODES[0]).toBe("INR");
    expect(DEFAULT_CURRENCY).toBe("INR");
  });
  it("still supports the other currencies", () => {
    expect([...CURRENCY_CODES].sort()).toEqual(["AUD", "CAD", "EUR", "GBP", "INR", "JPY", "USD"]);
  });
  it("validators accept every listed currency and reject unknown ones", () => {
    const expense = { description: "x", amount: 1, paidById: "11111111-1111-4111-8111-111111111111", date: "2026-01-01", participants: ["11111111-1111-4111-8111-111111111111"] };
    for (const currency of CURRENCY_CODES) {
      expect(createExpenseSchema.safeParse({ ...expense, currency }).success).toBe(true);
      expect(createGroupSchema.safeParse({ name: "Trip", category: "TRIP", currency }).success).toBe(true);
    }
    expect(createExpenseSchema.safeParse({ ...expense, currency: "XYZ" }).success).toBe(false);
  });
});
