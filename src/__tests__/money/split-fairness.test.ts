import { describe, it, expect } from "vitest";
import { calculateSplits, computeNetBalance } from "@/lib/algorithms/debt-simplification";
import { rowToRecord, type SplitwiseRow } from "@/lib/splitwise-import";
import { buildEdges, userNet } from "@/lib/ledger";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("equal split: leftover cents are spread one each, never dumped on one person", () => {
  it("₹100 between 3 is 33.34 / 33.33 / 33.33", () => {
    expect(Object.values(calculateSplits(10000, ids(3), "EQUAL"))).toEqual([3334, 3333, 3333]);
  });
  it("₹100 between 7 is 14.29 ×4 then 14.28 ×3 (shares differ by at most one cent)", () => {
    expect(Object.values(calculateSplits(10000, ids(7), "EQUAL"))).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });
  it("10 people and 9 cents over: nine people pay one cent more, not one person nine cents more", () => {
    const r = calculateSplits(1009, ids(10), "EQUAL");
    expect(Object.values(r).filter((v) => v === 101)).toHaveLength(9);
    expect(Object.values(r).filter((v) => v === 100)).toHaveLength(1);
  });
  it("evenly divisible totals are exactly equal", () => {
    expect(new Set(Object.values(calculateSplits(9000, ids(3), "EQUAL"))).size).toBe(1);
  });
  it("for ANY total and group size: exact sum, shares differ by at most one cent, whole non-negative cents", () => {
    for (let n = 1; n <= 40; n++) {
      for (const t of [1, 2, 99, 100, 101, 999, 10001, 123457, 99999999]) {
        const r = Object.values(calculateSplits(t, ids(n), "EQUAL"));
        expect(r.reduce((a, b) => a + b, 0), `${t}/${n}`).toBe(t);
        expect(Math.max(...r) - Math.min(...r), `${t}/${n}`).toBeLessThanOrEqual(1);
        expect(r.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
      }
    }
  });
  it("yen: whole yen only, still spread one yen each", () => {
    const r = Object.values(calculateSplits(100_000, ids(3), "EQUAL", undefined, 100)); // ¥1,000 between 3
    expect(r).toEqual([33400, 33300, 33300]); // ¥334 / ¥333 / ¥333
    expect(r.every((v) => v % 100 === 0)).toBe(true);
  });
});

describe("percentages", () => {
  it("33.33 + 33.33 + 33.33 (a normal thing to type) is within the 0.01% allowed and still adds up exactly", () => {
    const r = calculateSplits(10000, ids(3), "PERCENTAGE", { p0: 33.33, p1: 33.33, p2: 33.33 });
    expect(total(r)).toBe(10000);
  });
  it("is not at the mercy of float noise (0.1 + 0.2 style sums)", () => {
    expect(() => calculateSplits(10000, ids(3), "PERCENTAGE", { p0: 33.3, p1: 33.3, p2: 33.4 })).not.toThrow();
    expect(() => calculateSplits(10000, ids(2), "PERCENTAGE", { p0: 0.1 + 0.2 + 49.7, p1: 50 })).not.toThrow(); // 49.99999… + 50
  });
  it("still refuses percentages that are really off", () => {
    expect(() => calculateSplits(10000, ids(2), "PERCENTAGE", { p0: 50, p1: 49.9 })).toThrow(/sum to 100/);
    expect(() => calculateSplits(10000, ids(2), "PERCENTAGE", { p0: 60, p1: 50 })).toThrow(/sum to 100/);
  });
  it("FUZZ: percentages and shares with long decimals ALWAYS add up exactly (5,000 random cases)", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 5000; i++) {
      const n = 2 + Math.floor(rnd() * 9);
      const raw = Array.from({ length: n }, () => rnd() + 0.001);
      const sum = raw.reduce((a, b) => a + b, 0);
      const pct = raw.map((v) => (v / sum) * 100); // arbitrary long decimals summing to ~100
      const cents = 1 + Math.floor(rnd() * 1_000_000);
      const who = ids(n);
      const r1 = calculateSplits(cents, who, "PERCENTAGE", Object.fromEntries(who.map((id, k) => [id, pct[k]])));
      expect(total(r1), `pct ${i}`).toBe(cents);
      expect(Object.values(r1).every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
      const r2 = calculateSplits(cents, who, "SHARES", Object.fromEntries(who.map((id, k) => [id, raw[k] * 1000])));
      expect(total(r2), `shares ${i}`).toBe(cents);
    }
  });
});

describe("computeNetBalance understands several payers", () => {
  const splits = [{ userId: "a", amount: 3000 }, { userId: "b", amount: 3000 }, { userId: "c", amount: 3000 }];
  const expense = { paidById: "a", splits, payers: [{ userId: "a", amount: 6000 }, { userId: "b", amount: 3000 }] };
  it("each payer is credited what THEY paid, not the whole bill", () => {
    expect(computeNetBalance("a", [expense], [])).toBe(3000);  // paid 6000, owes 3000
    expect(computeNetBalance("b", [expense], [])).toBe(0);     // paid 3000, owes 3000
    expect(computeNetBalance("c", [expense], [])).toBe(-3000); // paid 0, owes 3000
  });
  it("everyone's balances add up to zero (money is neither created nor lost)", () => {
    expect(["a", "b", "c"].reduce((s, u) => s + computeNetBalance(u, [expense], []), 0)).toBe(0);
  });
  it("agrees with the shared ledger for a single payer too", () => {
    const single = { paidById: "a", splits };
    expect(computeNetBalance("a", [single], [])).toBe(6000);
    expect(computeNetBalance("b", [single], [{ fromUserId: "b", toUserId: "a", amount: 3000 }])).toBe(0);
  });
  it("matches the ledger's net position for a multi-payer expense", () => {
    const edges = buildEdges([{ id: "e", paidById: "a", currency: "INR", amount: 9000, splits, payers: expense.payers }], []);
    for (const u of ["a", "b", "c"]) expect(userNet(edges, u).get("INR") ?? 0, u).toBe(computeNetBalance(u, [expense], []));
  });
});

describe("Splitwise import: payers always add up to the cost exactly", () => {
  const mapping = { Asha: "u-asha", Bhanu: "u-bhanu", Chitra: "u-chitra" };
  const row = (over: Partial<SplitwiseRow>): SplitwiseRow => ({ date: "2026-01-05", description: "Dinner", category: "Dining out", cost: 90000, currency: "INR", isPayment: false, nets: {}, ...over });

  it("with balances a few cents off zero (which Splitwise exports sometimes have), two payers still add up to the cost", () => {
    const r = rowToRecord(row({ cost: 90000, nets: { Asha: 30001, Bhanu: 30000, Chitra: -60000 } }), mapping); // sums to +1
    expect(r.kind).toBe("expense");
    if (r.kind !== "expense") return;
    const e = r.expense;
    expect(e.payers.reduce((s, p) => s + p.amount, 0)).toBe(e.amount);
    expect(e.splits.reduce((s, x) => s + x.amount, 0)).toBe(e.amount);
  });

  it("…and a few cents off in the other direction", () => {
    const r = rowToRecord(row({ cost: 90000, nets: { Asha: 29999, Bhanu: 30000, Chitra: -60000 } }), mapping); // sums to −1
    if (r.kind !== "expense") throw new Error("expected an expense");
    expect(r.expense.payers.reduce((s, p) => s + p.amount, 0)).toBe(90000);
  });

  it("exact rows are untouched", () => {
    const r = rowToRecord(row({ cost: 90000, nets: { Asha: 40000, Bhanu: 20000, Chitra: -60000 } }), mapping);
    if (r.kind !== "expense") throw new Error("expected an expense");
    expect(r.expense.payers.reduce((s, p) => s + p.amount, 0)).toBe(90000);
    expect(r.expense.splits.reduce((s, x) => s + x.amount, 0)).toBe(90000);
  });
});
