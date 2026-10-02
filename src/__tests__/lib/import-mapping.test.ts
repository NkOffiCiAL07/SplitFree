import { describe, it, expect } from "vitest";
import { suggestMapping, usedNames, unmappedNames } from "@/lib/import-mapping";
import type { SplitwiseRow } from "@/lib/splitwise-import";

const me = { id: "me", name: "Nishant Kumar" };
const candidates = [
  { id: "a", name: "Asha Rao" },
  { id: "b", name: "Bhanu Pal" },
  { id: "c1", name: "Chitra Shah" },
  { id: "c2", name: "Chitra Mehta" },
];

describe("suggestMapping", () => {
  it("matches me by name or by Splitwise's 'You'", () => {
    expect(suggestMapping(["Nishant Kumar"], candidates, me)).toEqual({ "Nishant Kumar": "me" });
    expect(suggestMapping(["You"], candidates, me)).toEqual({ You: "me" });
    expect(suggestMapping(["nishant kumar"], candidates, me)).toEqual({ "nishant kumar": "me" });
  });

  it("matches others by full name, first name, or unique prefix (case-insensitive)", () => {
    const m = suggestMapping(["asha rao", "Bhanu", "Ash"], candidates, me);
    expect(m).toEqual({ "asha rao": "a", Bhanu: "b" }); // "Ash" is left alone: Asha is already taken
  });

  it("does not guess when two people fit equally well", () => {
    expect(suggestMapping(["Chitra"], candidates, me)).toEqual({});
  });

  it("never maps two names to the same person", () => {
    const m = suggestMapping(["Asha Rao", "Asha"], candidates, me);
    expect(Object.values(m)).toEqual(["a"]);
  });

  it("leaves unknown names for the user to choose", () => {
    expect(suggestMapping(["Zed"], candidates, me)).toEqual({});
  });

  it("still finds me when I'm not in the candidate list", () => {
    expect(suggestMapping(["Nishant"], [{ id: "a", name: "Asha" }], me)).toEqual({ Nishant: "me" });
  });
});

const row = (nets: Record<string, number>): SplitwiseRow => ({
  date: "2026-01-01", description: "x", category: "", cost: 100, currency: "INR", isPayment: false, nets,
});

describe("usedNames / unmappedNames", () => {
  const rows = [row({ Asha: 50, Bhanu: -50 }), row({ Asha: 20, Chitra: -20 })];
  it("lists only people who appear in a row", () => {
    expect(usedNames(rows).sort()).toEqual(["Asha", "Bhanu", "Chitra"]);
  });
  it("reports which of them still need a match", () => {
    expect(unmappedNames(rows, { Asha: "a" }).sort()).toEqual(["Bhanu", "Chitra"]);
    expect(unmappedNames(rows, { Asha: "a", Bhanu: "b", Chitra: "c" })).toEqual([]);
  });
});
