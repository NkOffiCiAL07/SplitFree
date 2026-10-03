import { describe, it, expect } from "vitest";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents } from "@/lib/utils";

// Deterministic PRNG so a failure is reproducible
function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("splits always add up to the total, to the cent (money must never appear or vanish)", () => {
  it("EQUAL — 3000 random totals and group sizes", () => {
    const r = rng(1);
    for (let i = 0; i < 3000; i++) {
      const total = 1 + Math.floor(r() * 10_000_000), n = 1 + Math.floor(r() * 30);
      const s = calculateSplits(total, ids(n), "EQUAL");
      expect(sum(s), `total ${total} n ${n}`).toBe(total);
      expect(Math.min(...Object.values(s))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...Object.values(s)) - Math.min(...Object.values(s)), "fair to within a few paise").toBeLessThanOrEqual(n);
    }
  });

  it("EXACT — random cent amounts expressed as dollars (floating point must not leak a cent)", () => {
    const r = rng(2);
    for (let i = 0; i < 3000; i++) {
      const n = 2 + Math.floor(r() * 8);
      const cents = ids(n).map(() => 1 + Math.floor(r() * 500_000));
      const total = cents.reduce((a, b) => a + b, 0);
      const overrides = Object.fromEntries(ids(n).map((id, k) => [id, cents[k] / 100]));
      const s = calculateSplits(total, ids(n), "EXACT", overrides);
      expect(sum(s), JSON.stringify(overrides)).toBe(total);
    }
  });

  it("EXACT — amounts that are a cent off are refused, not silently absorbed", () => {
    expect(() => calculateSplits(1000, ["a", "b"], "EXACT", { a: 5, b: 5.01 })).toThrow();
    expect(() => calculateSplits(1000, ["a", "b"], "EXACT", { a: 5, b: 4.99 })).toThrow();
  });

  it("PERCENTAGE — random percentages summing to 100", () => {
    const r = rng(3);
    for (let i = 0; i < 3000; i++) {
      const n = 2 + Math.floor(r() * 7), total = 1 + Math.floor(r() * 5_000_000);
      const raw = ids(n).map(() => 1 + r() * 100), t = raw.reduce((a, b) => a + b, 0);
      const pct = raw.map((x) => Math.round((x / t) * 10000) / 100);
      pct[n - 1] = Math.round((100 - pct.slice(0, -1).reduce((a, b) => a + b, 0)) * 100) / 100;
      if (pct.some((p) => p < 0)) continue;
      const s = calculateSplits(total, ids(n), "PERCENTAGE", Object.fromEntries(ids(n).map((id, k) => [id, pct[k]])));
      expect(sum(s), `total ${total} ${pct}`).toBe(total);
      expect(Math.min(...Object.values(s))).toBeGreaterThanOrEqual(0);
    }
  });

  it("SHARES — random share counts", () => {
    const r = rng(4);
    for (let i = 0; i < 3000; i++) {
      const n = 2 + Math.floor(r() * 8), total = 1 + Math.floor(r() * 5_000_000);
      const shares = Object.fromEntries(ids(n).map((id) => [id, 1 + Math.floor(r() * 5)]));
      const s = calculateSplits(total, ids(n), "SHARES", shares);
      expect(sum(s)).toBe(total);
      expect(Math.min(...Object.values(s))).toBeGreaterThanOrEqual(0);
    }
  });

  it("negative or non-participant entries can't be used to shift money", () => {
    expect(() => calculateSplits(1000, ["a", "b"], "EXACT", { a: 15, b: -5 })).toThrow();
    expect(() => calculateSplits(1000, ["a", "b"], "PERCENTAGE", { a: 150, b: -50 })).toThrow();
    expect(() => calculateSplits(1000, ["a", "b"], "SHARES", { a: 3, b: -1 })).toThrow();
    // a stranger's 50% must not reduce what the real participants owe in total
    expect(() => calculateSplits(1000, ["a", "b"], "PERCENTAGE", { a: 25, b: 25, ghost: 50 })).toThrow();
  });

  it("a participant with zero shares owes nothing, including rounding drift", () => {
    const s = calculateSplits(1001, ["a", "b", "c"], "SHARES", { a: 1, b: 1, c: 0 });
    expect(s.c).toBe(0);
    expect(sum(s)).toBe(1001);
  });
});

describe("toCents", () => {
  it("converts typical amounts exactly", () => {
    for (const [d, c] of [[0.1, 10], [0.29, 29], [1.15, 115], [19.99, 1999], [1.005, 101], [8.675, 868], [1234567.89, 123456789]] as const)
      expect(toCents(d), String(d)).toBe(c);
  });
  it("never drifts for any whole-paise amount up to the limit", () => {
    for (let c = 1; c <= 100_000_000; c += 9973) expect(toCents(c / 100)).toBe(c);
  });
});
