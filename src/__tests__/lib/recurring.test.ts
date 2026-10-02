import { describe, it, expect } from "vitest";
import { monthlyEquivalent, monthlyByCurrency } from "@/lib/recurring";

describe("monthlyEquivalent", () => {
  it("scales each interval to a month", () => {
    expect(monthlyEquivalent(1000, "DAILY")).toBe(30000);
    expect(monthlyEquivalent(1000, "WEEKLY")).toBeCloseTo(4330);
    expect(monthlyEquivalent(1000, "MONTHLY")).toBe(1000);
    expect(monthlyEquivalent(12000, "YEARLY")).toBe(1000);
  });
  it("treats a missing or unknown interval as monthly", () => {
    expect(monthlyEquivalent(500, null)).toBe(500);
    expect(monthlyEquivalent(500, undefined)).toBe(500);
    expect(monthlyEquivalent(500, "FORTNIGHTLY")).toBe(500);
  });
});

describe("monthlyByCurrency", () => {
  it("is empty without expenses", () => {
    expect(monthlyByCurrency([])).toEqual([]);
  });
  it("sums per currency without mixing, largest first", () => {
    const out = monthlyByCurrency([
      { amount: 50000, currency: "INR", recurringInterval: "MONTHLY" },
      { amount: 120000, currency: "INR", recurringInterval: "YEARLY" },
      { amount: 999, currency: "USD", recurringInterval: "MONTHLY" },
    ]);
    expect(out).toEqual([{ currency: "INR", amount: 60000 }, { currency: "USD", amount: 999 }]);
  });
});
