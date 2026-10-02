import { describe, it, expect } from "vitest";
import { createExpenseSchema } from "@/lib/validations/expense";

const validExpense = {
  description: "Dinner",
  amount: 50,
  paidById: "123e4567-e89b-12d3-a456-426614174000",
  date: new Date("2024-01-15"),
  participants: ["123e4567-e89b-12d3-a456-426614174000"],
};

describe("createExpenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(() => createExpenseSchema.parse(validExpense)).not.toThrow();
  });

  it("rejects empty description", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, description: "" })).toThrow();
  });

  it("rejects description over 200 chars", () => {
    expect(() =>
      createExpenseSchema.parse({ ...validExpense, description: "x".repeat(201) })
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, amount: 0 })).toThrow();
  });

  it("rejects negative amount", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, amount: -10 })).toThrow();
  });

  it("rejects amount over 1,000,000", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, amount: 1_000_001 })).toThrow();
  });

  it("rejects invalid paidById (not UUID)", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, paidById: "not-a-uuid" })).toThrow();
  });

  it("rejects empty participants", () => {
    expect(() => createExpenseSchema.parse({ ...validExpense, participants: [] })).toThrow();
  });

  it("rejects invalid participant UUID", () => {
    expect(() =>
      createExpenseSchema.parse({ ...validExpense, participants: ["bad-id"] })
    ).toThrow();
  });

  it("defaults currency to INR", () => {
    const result = createExpenseSchema.parse(validExpense);
    expect(result.currency).toBe("INR");
  });

  it("defaults splitType to EQUAL", () => {
    const result = createExpenseSchema.parse(validExpense);
    expect(result.splitType).toBe("EQUAL");
  });

  it("defaults category to OTHER", () => {
    const result = createExpenseSchema.parse(validExpense);
    expect(result.category).toBe("OTHER");
  });

  it("defaults isRecurring to false", () => {
    const result = createExpenseSchema.parse(validExpense);
    expect(result.isRecurring).toBe(false);
  });

  it("accepts all split types", () => {
    const splitTypes = ["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const;
    splitTypes.forEach((splitType) => {
      expect(() => createExpenseSchema.parse({ ...validExpense, splitType })).not.toThrow();
    });
  });

  it("accepts all expense categories", () => {
    const categories = [
      "FOOD", "TRANSPORT", "ACCOMMODATION", "ENTERTAINMENT",
      "UTILITIES", "SHOPPING", "HEALTH", "TRAVEL", "EDUCATION", "OTHER",
    ] as const;
    categories.forEach((category) => {
      expect(() => createExpenseSchema.parse({ ...validExpense, category })).not.toThrow();
    });
  });

  it("accepts recurring expense with interval", () => {
    const result = createExpenseSchema.parse({
      ...validExpense,
      isRecurring: true,
      recurringInterval: "MONTHLY",
    });
    expect(result.isRecurring).toBe(true);
    expect(result.recurringInterval).toBe("MONTHLY");
  });

  it("coerces date string to Date", () => {
    const result = createExpenseSchema.parse({ ...validExpense, date: "2024-06-15" });
    expect(result.date).toBeInstanceOf(Date);
  });

  it("accepts optional groupId", () => {
    const result = createExpenseSchema.parse({
      ...validExpense,
      groupId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.groupId).toBeTruthy();
  });

  it("accepts optional notes", () => {
    const result = createExpenseSchema.parse({ ...validExpense, notes: "Paid in cash" });
    expect(result.notes).toBe("Paid in cash");
  });

  it("rejects notes over 500 chars", () => {
    expect(() =>
      createExpenseSchema.parse({ ...validExpense, notes: "x".repeat(501) })
    ).toThrow();
  });
});
