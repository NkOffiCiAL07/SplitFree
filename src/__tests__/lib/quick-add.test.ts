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

import { analyseQuickText } from "@/lib/quick-add";

describe("analyseQuickText — the live tags", () => {
  it("understands the example sentence: title, amount, people and rule — and keeps the rule out of the last name", () => {
    const a = analyseQuickText("Dinner at Luigi's $90 with Asha and Leo split equally");
    expect(a.description).toBe("Dinner at Luigi's");
    expect(a.amount).toBe(90);
    expect(a.names).toEqual(["Asha", "Leo"]);
    expect(a.rule).toBe("EQUAL");
    expect(a.currency).toBe("USD");
    expect(a.tags).toEqual([
      { kind: "title", text: "Dinner at Luigi's" },
      { kind: "amount", text: "$90" },
      { kind: "person", text: "Asha" },
      { kind: "person", text: "Leo" },
      { kind: "rule", text: "Split equally" },
    ]);
  });

  it.each([
    ["Taxi 450 with Rahul divide it evenly", ["Rahul"]],
    ["Pizza 600 with Mia and Liam equally", ["Mia", "Liam"]],
    ["Pizza 600 with Mia, Liam & Noah split evenly", ["Mia", "Liam", "Noah"]],
  ])("%s → rule detected, names clean", (text, names) => {
    const a = analyseQuickText(text);
    expect(a.rule).toBe("EQUAL");
    expect(a.names).toEqual(names);
  });

  it("reads the currency from the symbol: ₹ £ € $", () => {
    expect(analyseQuickText("Chai ₹40").currency).toBe("INR");
    expect(analyseQuickText("Pub £25 with Tom").currency).toBe("GBP");
    expect(analyseQuickText("Wine €30").currency).toBe("EUR");
    expect(analyseQuickText("Chai 40").currency).toBeNull();
  });

  it("builds tags progressively while typing, never inventing pieces", () => {
    expect(analyseQuickText("").tags).toEqual([]);
    expect(analyseQuickText("Dinn").tags).toEqual([{ kind: "title", text: "Dinn" }]);
    expect(analyseQuickText("Dinner 90").tags.map((t) => t.kind)).toEqual(["title", "amount"]);
    expect(analyseQuickText("Dinner 90 with").tags.map((t) => t.kind)).toEqual(["title", "amount"]);
    expect(analyseQuickText("Dinner 90 with As").tags.map((t) => t.kind)).toEqual(["title", "amount", "person"]);
  });

  it("no rule is claimed unless it was said; 'equal' inside a word is not a rule", () => {
    expect(analyseQuickText("Dinner 90 with Asha").rule).toBeNull();
    expect(analyseQuickText("Equalizer concert ticket 80").rule).toBeNull();
  });

  it("is consistent with the plain parser for everything it already understood", () => {
    for (const t of ["Dinner 1200 with Rahul and Priya", "iPhone 15 case 500", "Rent 15k", "Chai ₹40 with Asha"]) {
      const a = analyseQuickText(t), b = parseQuickExpense(t);
      expect([a.description, a.amount, a.names]).toEqual([b.description, b.amount, b.names]);
    }
  });
});
