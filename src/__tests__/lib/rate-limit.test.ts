import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { rateLimit, rateLimitSize, resetRateLimits } from "@/lib/rate-limit";

beforeEach(resetRateLimits);

describe("rateLimit", () => {
  it("allows up to the limit inside the window, then refuses with a retry time", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 60_000, 1_000 + i).ok).toBe(true);
    const blocked = rateLimit("k", 5, 60_000, 1_010);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(59);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("counts down what is left", () => {
    expect(rateLimit("k", 3, 1_000, 0).remaining).toBe(2);
    expect(rateLimit("k", 3, 1_000, 1).remaining).toBe(1);
    expect(rateLimit("k", 3, 1_000, 2).remaining).toBe(0);
  });

  it("is a SLIDING window: old requests stop counting as time passes", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1_000, i);
    expect(rateLimit("k", 3, 1_000, 500).ok).toBe(false);
    expect(rateLimit("k", 3, 1_000, 1_001).ok).toBe(true); // the first hit (t=0) has left the window
  });

  it("keeps clients apart, and a refused request does not extend the block", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1_000, 0);
    expect(rateLimit("a", 3, 1_000, 10).ok).toBe(false);
    expect(rateLimit("b", 3, 1_000, 10).ok).toBe(true);
    expect(rateLimit("a", 3, 1_000, 1_001).ok).toBe(true); // refused hits were not counted
  });

  it("never holds more than a bounded number of clients (no memory leak under a flood of different addresses)", () => {
    for (let i = 0; i < 12_000; i++) rateLimit(`ip-${i}`, 5, 60_000, i);
    expect(rateLimitSize()).toBeLessThanOrEqual(5_000);
    // …and the most recent clients are the ones still remembered
    for (let i = 0; i < 5; i++) rateLimit("ip-11999", 5, 60_000, 12_000 + i);
    expect(rateLimit("ip-11999", 5, 60_000, 12_010).ok).toBe(false);
  });

  it("limit() style helper in api-helpers returns a 429 with Retry-After", async () => {
    const { tooManyRequests, clientIp } = await import("@/lib/api-helpers");
    expect(tooManyRequests("u1", "x", 2)).toBeNull();
    expect(tooManyRequests("u1", "x", 2)).toBeNull();
    const res = tooManyRequests("u1", "x", 2)!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect((await res.json()).error.message).toMatch(/too many requests/i);
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }))).toBe("203.0.113.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
