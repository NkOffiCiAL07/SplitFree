import { describe, it, expect } from "vitest";
import { parsePayers, payersRemainingCents, payersProblem, evenPayerAmounts } from "@/lib/payers";

describe("parsePayers", () => {
  it("keeps only positive numeric amounts", () => {
    expect(parsePayers({ a: "100", b: "", c: "0", d: "abc", e: "50.5" })).toEqual([
      { userId: "a", amount: 100 }, { userId: "e", amount: 50.5 },
    ]);
  });
});

describe("payersRemainingCents", () => {
  it("is positive when under-allocated, negative when over, zero when exact", () => {
    expect(payersRemainingCents(300, { a: "200", b: "50" })).toBe(5000);
    expect(payersRemainingCents(300, { a: "200", b: "150" })).toBe(-5000);
    expect(payersRemainingCents(300, { a: "200", b: "100" })).toBe(0);
  });
  it("is float-safe for amounts like 0.1 + 0.2", () => {
    expect(payersRemainingCents(0.3, { a: "0.1", b: "0.2" })).toBe(0);
  });
});

describe("payersProblem", () => {
  it("explains what's wrong", () => {
    expect(payersProblem(0, { a: "1", b: "1" })).toMatch(/total amount/i);
    expect(payersProblem(300, { a: "300" })).toMatch(/at least two/i);
    expect(payersProblem(300, { a: "200", b: "50" })).toMatch(/less than/i);
    expect(payersProblem(300, { a: "200", b: "150" })).toMatch(/more than/i);
  });
  it("is null when the payers add up", () => {
    expect(payersProblem(300, { a: "200", b: "100" })).toBeNull();
  });
});

describe("evenPayerAmounts", () => {
  it("splits evenly to the paisa with the remainder on the first person", () => {
    expect(evenPayerAmounts(100, ["a", "b", "c"])).toEqual({ a: "33.34", b: "33.33", c: "33.33" });
    expect(evenPayerAmounts(90, ["a", "b"])).toEqual({ a: "45.00", b: "45.00" });
  });
  it("returns nothing for no people or an invalid total", () => {
    expect(evenPayerAmounts(100, [])).toEqual({});
    expect(evenPayerAmounts(0, ["a"])).toEqual({});
  });
});
