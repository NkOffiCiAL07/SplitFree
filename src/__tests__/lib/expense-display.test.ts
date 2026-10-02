import { describe, it, expect } from "vitest";
import { paidBy, netForUser, payersLabel } from "@/lib/expense-display";
import type { Expense } from "@/types";

const e = (over: Partial<Expense>) => ({ paidById: "a", amount: 900, splits: [], ...over }) as unknown as Expense;
const split = (userId: string, amount: number) => ({ userId, amount }) as Expense["splits"] extends (infer T)[] | undefined ? T : never;

describe("paidBy", () => {
  it("single payer paid everything", () => {
    expect(paidBy(e({}), "a")).toBe(900);
    expect(paidBy(e({}), "b")).toBe(0);
  });
  it("multi-payer uses each payer's own amount", () => {
    const x = e({ payers: [{ userId: "a", amount: 600 }, { userId: "b", amount: 300 }] });
    expect(paidBy(x, "a")).toBe(600);
    expect(paidBy(x, "b")).toBe(300);
    expect(paidBy(x, "c")).toBe(0);
  });
});

describe("netForUser", () => {
  const x = e({ splits: [split("a", 300), split("b", 300), split("c", 300)] });
  it("positive for someone who is owed, negative for someone who owes", () => {
    expect(netForUser(x, "a")).toBe(600); // paid 900, consumed 300
    expect(netForUser(x, "b")).toBe(-300);
  });
  it("null when the user is not involved", () => {
    expect(netForUser(x, "z")).toBeNull();
  });
  it("accounts for several payers", () => {
    const m = e({
      payers: [{ userId: "a", amount: 600 }, { userId: "b", amount: 300 }],
      splits: [split("a", 300), split("b", 300), split("c", 300)],
    });
    expect(netForUser(m, "a")).toBe(300);
    expect(netForUser(m, "b")).toBe(0);
    expect(netForUser(m, "c")).toBe(-300);
  });
  it("is zero (not null) for a payer who consumed exactly what they paid", () => {
    expect(netForUser(e({ amount: 500, splits: [split("a", 500)] }), "a")).toBe(0);
  });
});

describe("payersLabel", () => {
  it("names the single payer", () => {
    expect(payersLabel({ paidBy: { name: "Asha Rao" } } as Expense)).toBe("Asha Rao");
    expect(payersLabel({} as Expense)).toBe("Unknown");
  });
  it("lists first names for several payers", () => {
    expect(payersLabel({
      payers: [{ userId: "a", amount: 1, user: { name: "Asha Rao" } }, { userId: "b", amount: 1, user: { name: "Bhanu Pal" } }],
    } as unknown as Expense)).toBe("Asha, Bhanu");
  });
});
