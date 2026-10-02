import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cn,
  formatCurrency,
  formatCompactCurrency,
  toCents,
  fromCents,
  formatDate,
  formatRelativeTime,
  getInitials,
  truncate,
  slugify,
  groupBy,
  sum,
  amountColor,
  parseError,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });
  it("deduplicates tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatCurrency", () => {
  it("formats cents to USD", () => {
    expect(formatCurrency(1000)).toBe("$10.00");
  });
  it("formats 0 cents", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
  it("formats negative cents", () => {
    expect(formatCurrency(-500)).toBe("-$5.00");
  });
  it("formats INR", () => {
    const result = formatCurrency(10000, "INR");
    expect(result).toContain("100");
  });
  it("formats fractional cents correctly", () => {
    expect(formatCurrency(999)).toBe("$9.99");
  });
});

describe("formatCompactCurrency", () => {
  it("shows full amount below 1000", () => {
    expect(formatCompactCurrency(50000)).toBe("$500.00"); // $500 in cents
  });
  it("abbreviates thousands with K", () => {
    const result = formatCompactCurrency(1500000); // $15000
    expect(result).toContain("K");
  });
  it("uses minus sign for negative amounts", () => {
    const result = formatCompactCurrency(-50000); // -$500
    expect(result).toContain("−");
  });
  it("zero returns zero", () => {
    const result = formatCompactCurrency(0);
    expect(result).toContain("0");
  });
});

describe("toCents / fromCents", () => {
  it("converts dollars to cents", () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(10.99)).toBe(1099);
  });
  it("converts cents to dollars", () => {
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1099)).toBe(10.99);
  });
  it("round-trips correctly", () => {
    expect(toCents(fromCents(2550))).toBe(2550);
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("2024");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });
  it("formats a Date object", () => {
    const result = formatDate(new Date("2024-06-01"));
    expect(result).toContain("Jun");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns 'just now' for recent timestamps", () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    vi.setSystemTime(new Date("2024-01-01T12:30:00Z"));
    expect(formatRelativeTime(new Date("2024-01-01T12:25:00Z"))).toBe("5m ago");
  });

  it("returns hours ago", () => {
    vi.setSystemTime(new Date("2024-01-01T14:00:00Z"));
    expect(formatRelativeTime(new Date("2024-01-01T11:00:00Z"))).toBe("3h ago");
  });

  it("returns days ago", () => {
    vi.setSystemTime(new Date("2024-01-05T12:00:00Z"));
    expect(formatRelativeTime(new Date("2024-01-03T12:00:00Z"))).toBe("2d ago");
  });
});

describe("getInitials", () => {
  it("returns initials for two-word name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });
  it("returns single initial for one-word name", () => {
    expect(getInitials("Alice")).toBe("A");
  });
  it("handles three-word name (max 2 chars)", () => {
    expect(getInitials("Alice Bob Charlie")).toBe("AB");
  });
  it("uppercases result", () => {
    expect(getInitials("john doe")).toBe("JD");
  });
});

describe("truncate", () => {
  it("does not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates long strings", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
  it("truncates exactly at limit", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });
});

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("removes special characters", () => {
    expect(slugify("Hello! World@#")).toBe("hello-world");
  });
  it("collapses multiple hyphens", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });
});

describe("groupBy", () => {
  it("groups array by key", () => {
    const items = [
      { type: "A", val: 1 },
      { type: "B", val: 2 },
      { type: "A", val: 3 },
    ];
    const result = groupBy(items, "type");
    expect(result["A"]).toHaveLength(2);
    expect(result["B"]).toHaveLength(1);
  });
  it("returns empty object for empty array", () => {
    expect(groupBy([], "id" as never)).toEqual({});
  });
});

describe("sum", () => {
  it("sums an array of numbers", () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });
  it("returns 0 for empty array", () => {
    expect(sum([])).toBe(0);
  });
  it("handles negative numbers", () => {
    expect(sum([5, -3, 2])).toBe(4);
  });
});

describe("amountColor", () => {
  it("returns green for positive", () => {
    expect(amountColor(100)).toContain("green");
  });
  it("returns red for negative", () => {
    expect(amountColor(-100)).toContain("red");
  });
  it("returns muted for zero", () => {
    expect(amountColor(0)).toContain("muted");
  });
});

describe("parseError", () => {
  it("extracts message from Error", () => {
    expect(parseError(new Error("boom"))).toBe("boom");
  });
  it("returns string errors as-is", () => {
    expect(parseError("oops")).toBe("oops");
  });
  it("returns fallback for unknown types", () => {
    expect(parseError({ code: 500 })).toBe("An unexpected error occurred");
  });
});
