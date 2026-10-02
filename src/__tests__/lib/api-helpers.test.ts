import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { parseLimit, clientIp, visibleToUser, rateLimit } from "@/lib/api-helpers";

describe("parseLimit", () => {
  it("falls back to the default for missing or invalid values", () => {
    expect(parseLimit(null)).toBe(50);
    expect(parseLimit("abc")).toBe(50);
    expect(parseLimit("-5")).toBe(50);
    expect(parseLimit("0")).toBe(50);
  });
  it("caps at the maximum", () => {
    expect(parseLimit("1000")).toBe(100);
    expect(parseLimit("25")).toBe(25);
  });
  it("respects a custom default", () => {
    expect(parseLimit(null, 20)).toBe(20);
  });
});

describe("clientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("returns unknown without the header", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("visibleToUser", () => {
  it("matches expenses the user paid, is one of several payers on, or is split on", () => {
    expect(visibleToUser("u1")).toEqual({
      OR: [{ splits: { some: { userId: "u1" } } }, { paidById: "u1" }, { payers: { some: { userId: "u1" } } }],
    });
  });
});

describe("rateLimit", () => {
  it("blocks after the limit within the window", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2)).toBe(false);
    expect(rateLimit(key, 2)).toBe(false);
    expect(rateLimit(key, 2)).toBe(true);
  });
});
