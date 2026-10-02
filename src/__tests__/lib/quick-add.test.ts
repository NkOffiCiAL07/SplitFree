import { describe, it, expect } from "vitest";
import { parseQuickExpense, matchPeople } from "@/lib/quick-add";

describe("parseQuickExpense", () => {
  it("parses description, amount and names", () => {
    expect(parseQuickExpense("Dinner 1200 with Rahul and Priya")).toEqual({
      description: "Dinner", amount: 1200, names: ["Rahul", "Priya"],
    });
  });
  it("handles currency symbols, commas and decimals", () => {
    expect(parseQuickExpense("₹1,250.50 cab").amount).toBe(1250.5);
    expect(parseQuickExpense("lunch $12 with Sam").amount).toBe(12);
  });
  it("supports k suffix and comma/& separators", () => {
    const r = parseQuickExpense("rent 1.5k with Ann, Bob & Cy");
    expect(r.amount).toBe(1500);
    expect(r.names).toEqual(["Ann", "Bob", "Cy"]);
  });
  it("works without names or amount", () => {
    expect(parseQuickExpense("movie 400")).toEqual({ description: "Movie", amount: 400, names: [] });
    expect(parseQuickExpense("just a note").amount).toBeNull();
    expect(parseQuickExpense("")).toEqual({ description: "", amount: null, names: [] });
  });
  it("uses the last number as the amount and keeps earlier ones in the description", () => {
    expect(parseQuickExpense("2 tickets 800")).toMatchObject({ description: "2 tickets", amount: 800 });
  });
});

describe("matchPeople", () => {
  const people = [
    { id: "1", name: "Rahul Kumar" },
    { id: "2", name: "Priya Shah" },
    { id: "3", name: "Priyanka Rao" },
  ];
  it("matches first names and prefixes, case-insensitively", () => {
    const { matched, unmatched } = matchPeople(["rahul", "Priya", "Zed"], people);
    expect(matched.map((p) => p.id)).toEqual(["1", "2"]);
    expect(unmatched).toEqual(["Zed"]);
  });
});
