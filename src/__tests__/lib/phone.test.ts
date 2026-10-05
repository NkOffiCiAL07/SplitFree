import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone, formatPhone } from "@/lib/phone";

describe("normalizePhone — Indian mobiles (the default)", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["0091 98765 43210", "+919876543210"],
    ["  (+91) 98765 43210 ", "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("%s → %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(["", "   ", "12345", "98765432", "98765432101", "5876543210", "0987654321", "+915876543210", "abcdefghij", "98765 4321a", "9876543210 ext 5", "98765/43210"])(
    "rejects %j",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("normalizePhone — other countries need their + code", () => {
  it.each([
    ["+1 (415) 555-2671", "+14155552671"],
    ["+44 7911 123456", "+447911123456"],
    ["0044 7911 123456", "+447911123456"],
    ["+971 50 123 4567", "+971501234567"],
  ])("%s → %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("rejects too short, too long and a leading +0", () => {
    expect(normalizePhone("+1234567")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
    expect(normalizePhone("+0123456789")).toBeNull();
  });
  it("a foreign number typed without + is NOT guessed", () => {
    expect(normalizePhone("4155552671")).toBeNull(); // not an Indian mobile (starts with 4)
  });
});

describe("isValidPhone / formatPhone", () => {
  it("handles null and undefined", () => {
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
    expect(isValidPhone("9876543210")).toBe(true);
    expect(formatPhone(null)).toBe("");
  });
  it("groups Indian numbers and leaves others alone", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+14155552671")).toBe("+14155552671");
  });
  it("is idempotent: a stored number normalises to itself", () => {
    for (const n of ["+919876543210", "+14155552671", "+447911123456"]) expect(normalizePhone(n)).toBe(n);
  });
});

describe("normalizePhone — a visitor whose country we know can type a national number", () => {
  it.each([
    ["415 555 2671", "1", "+14155552671"],
    ["(415) 555-2671", "1", "+14155552671"],
    ["07911 123456", "44", "+447911123456"],
    ["0412 345 678", "61", "+61412345678"],
    ["+44 7911 123456", "44", "+447911123456"], // an explicit + still wins
  ])("%s with dial %s → %s", (input, dial, expected) => expect(normalizePhone(input, dial)).toBe(expected));

  it("still rejects junk, and never guesses without a known country", () => {
    expect(normalizePhone("12345", "1")).toBeNull();
    expect(normalizePhone("abc", "44")).toBeNull();
    expect(normalizePhone("415 555 2671")).toBeNull();
  });
  it("India's own rules are unchanged by a +91 default", () => {
    expect(normalizePhone("98765 43210", "91")).toBe("+919876543210");
    expect(normalizePhone("5876543210", "91")).toBeNull();
  });
});
