import { describe, it, expect } from "vitest";
import { buildExpenseFilter } from "@/lib/expense-filters";

const f = (qs: string) => buildExpenseFilter(new URLSearchParams(qs));

describe("buildExpenseFilter", () => {
  it("is empty without filters", () => {
    expect(f("")).toEqual({});
    expect(f("limit=20&cursor=abc&paged=true")).toEqual({});
  });

  it("searches description, notes, payer and group name case-insensitively", () => {
    const where = f("q=goa");
    expect(where.AND).toEqual([{
      OR: [
        { description: { contains: "goa", mode: "insensitive" } },
        { notes: { contains: "goa", mode: "insensitive" } },
        { paidBy: { name: { contains: "goa", mode: "insensitive" } } },
        { group: { name: { contains: "goa", mode: "insensitive" } } },
      ],
    }]);
  });

  it("trims and caps the search text, ignoring blank searches", () => {
    expect(f("q=%20%20")).toEqual({});
    const long = "x".repeat(300);
    const where = f(`q=${long}`);
    const first = (where.AND as { OR: { description: { contains: string } }[] }[])[0].OR[0].description.contains;
    expect(first).toHaveLength(100);
  });

  it("filters by group, category, date range and recurring", () => {
    const where = f("groupId=g1&category=FOOD&from=2026-01-01&to=2026-01-31&recurring=true");
    expect(where.AND).toEqual([
      { groupId: "g1" },
      { category: "FOOD" },
      { date: { gte: new Date("2026-01-01T00:00:00.000Z") } },
      { date: { lte: new Date("2026-01-31T23:59:59.999Z") } },
      { isRecurring: true },
    ]);
  });

  it("includes the whole 'to' day", () => {
    const where = f("to=2026-03-05");
    expect(where.AND).toEqual([{ date: { lte: new Date("2026-03-05T23:59:59.999Z") } }]);
  });

  it("ignores invalid categories, malformed dates and non-true recurring flags", () => {
    expect(f("category=HACK&from=yesterday&to=2026-13&recurring=false")).toEqual({});
    expect(f("from=2026-02-31&to=2026-00-10")).toEqual({}); // well-formed but not real days
    expect(f("category=ALL")).toEqual({}); // the UI's "All categories" value
  });

  it("accepts leap days only in leap years", () => {
    expect(f("from=2028-02-29").AND).toHaveLength(1);
    expect(f("from=2027-02-29")).toEqual({});
  });
});
