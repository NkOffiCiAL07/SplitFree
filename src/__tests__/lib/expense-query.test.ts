import { describe, it, expect } from "vitest";
import { expenseQueryString } from "@/hooks/use-expenses";

const q = (query: Parameters<typeof expenseQueryString>[0], cursor?: string | null) =>
  Object.fromEntries(new URLSearchParams(expenseQueryString(query, cursor)));

describe("expenseQueryString", () => {
  it("always asks for the paged shape", () => {
    expect(q({})).toEqual({ paged: "true" });
  });

  it("leaves out empty filters and the UI's 'ALL' category", () => {
    expect(q({ q: "  ", category: "ALL", from: "", to: "" })).toEqual({ paged: "true" });
  });

  it("includes every active filter, trimmed", () => {
    expect(q({ groupId: "g1", q: " goa ", category: "FOOD", from: "2026-01-01", to: "2026-01-31", recurring: true, limit: 100 })).toEqual({
      paged: "true", groupId: "g1", q: "goa", category: "FOOD", from: "2026-01-01", to: "2026-01-31", recurring: "true", limit: "100",
    });
  });

  it("adds the cursor for the next page, and encodes special characters safely", () => {
    expect(q({}, "abc")).toEqual({ paged: "true", cursor: "abc" });
    expect(q({ q: "a&b=c" }).q).toBe("a&b=c");
  });
});
