import { describe, it, expect } from "vitest";
import { calculateSplits, simplifyDebts } from "@/lib/algorithms/debt-simplification";
import { expenseEdges, userNet, type LedgerExpense } from "@/lib/ledger";
import { toCents } from "@/lib/utils";

/** The money scenarios from the Play Store release checklist, spelled out with the exact numbers. Amounts are in paise/cents. */
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const people = ["rahul", "nishant", "asha", "mia"];

describe("release checklist: split types", () => {
  it("equal: ₹1,000 between 4 is ₹250 each", () => {
    expect(calculateSplits(toCents(1000), people, "EQUAL")).toEqual({ rahul: 25000, nishant: 25000, asha: 25000, mia: 25000 });
  });

  it("equal with a remainder: ₹100 between 3 is 33.34 / 33.33 / 33.33 and always sums to the total", () => {
    const r = calculateSplits(10000, ["a", "b", "c"], "EQUAL");
    expect(Object.values(r).sort()).toEqual([3333, 3333, 3334]);
    expect(sum(r)).toBe(10000);
  });

  it("exact: different amounts per person must add up to the total, otherwise it is refused", () => {
    const r = calculateSplits(100000, people, "EXACT", { rahul: 400, nishant: 300, asha: 200, mia: 100 });
    expect(r).toEqual({ rahul: 40000, nishant: 30000, asha: 20000, mia: 10000 });
    expect(() => calculateSplits(100000, people, "EXACT", { rahul: 400, nishant: 300, asha: 200, mia: 50 })).toThrow();
  });

  it("percentage: 50/30/20 of ₹1,000, and percentages that do not total 100 are refused", () => {
    expect(calculateSplits(100000, ["a", "b", "c"], "PERCENTAGE", { a: 50, b: 30, c: 20 })).toEqual({ a: 50000, b: 30000, c: 20000 });
    expect(() => calculateSplits(100000, ["a", "b", "c"], "PERCENTAGE", { a: 50, b: 30, c: 10 })).toThrow();
  });

  it("shares: 2:1:1 of ₹1,000 is 500 / 250 / 250, and odd amounts still add up exactly", () => {
    expect(calculateSplits(100000, ["a", "b", "c"], "SHARES", { a: 2, b: 1, c: 1 })).toEqual({ a: 50000, b: 25000, c: 25000 });
    const odd = calculateSplits(100001, ["a", "b", "c"], "SHARES", { a: 3, b: 2, c: 2 });
    expect(sum(odd)).toBe(100001);
  });

  it("whole-unit currencies (yen) never produce fractions", () => {
    const r = calculateSplits(100000, ["a", "b", "c"], "EQUAL", undefined, 100); // ¥1,000 in stored units, unit 100
    expect(Object.values(r).every((v) => v % 100 === 0)).toBe(true);
    expect(sum(r)).toBe(100000);
  });

  it("every split type sums to the total for awkward totals", () => {
    for (const total of [1, 7, 99, 100, 101, 333, 9999, 123457]) {
      expect(sum(calculateSplits(total, ["a", "b", "c"], "EQUAL")), `equal ${total}`).toBe(total);
      expect(sum(calculateSplits(total, ["a", "b", "c"], "SHARES", { a: 1, b: 2, c: 4 })), `shares ${total}`).toBe(total);
    }
  });
});

describe("release checklist: multiple payers", () => {
  it("Rahul pays ₹700 and Nishant pays ₹300 for a ₹1,000 dinner split equally between 4: Rahul is owed ₹450 and Nishant ₹50", () => {
    const e: LedgerExpense = {
      paidById: "rahul", currency: "INR", amount: 100000, groupId: "g",
      payers: [{ userId: "rahul", amount: 70000 }, { userId: "nishant", amount: 30000 }],
      splits: people.map((p) => ({ userId: p, amount: 25000 })),
    };
    const edges = expenseEdges(e);
    const nets = (id: string) => [...userNet(edges, id).values()].reduce((a, b) => a + b, 0);
    expect(nets("rahul")).toBe(45000);   // paid 700, owes 250 → is owed 450
    expect(nets("nishant")).toBe(5000);  // paid 300, owes 250 → is owed 50
    expect(nets("asha")).toBe(-25000);
    expect(nets("mia")).toBe(-25000);
    expect(people.reduce((a, p) => a + nets(p), 0)).toBe(0); // money is neither created nor lost
  });
});

describe("release checklist: circular debts and settle-up", () => {
  const net = (debts: { fromUserId: string; toUserId: string; amount: number }[]) => {
    const m = new Map<string, number>();
    for (const d of debts) { m.set(d.fromUserId, (m.get(d.fromUserId) ?? 0) - d.amount); m.set(d.toUserId, (m.get(d.toUserId) ?? 0) + d.amount); }
    return m;
  };

  it("a circle of equal debts (A→B→C→A) cancels out completely: nobody has to pay anyone", () => {
    const debts = [{ fromUserId: "a", toUserId: "b", amount: 10000 }, { fromUserId: "b", toUserId: "c", amount: 10000 }, { fromUserId: "c", toUserId: "a", amount: 10000 }];
    expect(simplifyDebts(debts)).toEqual([]);
  });

  it("ten tangled debts between five people become a few payments that leave every person's net position unchanged", () => {
    const ids = ["a", "b", "c", "d", "e"]; const debts: { fromUserId: string; toUserId: string; amount: number }[] = [];
    let k = 1;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) debts.push(k++ % 2 ? { fromUserId: ids[i], toUserId: ids[j], amount: 1000 * k } : { fromUserId: ids[j], toUserId: ids[i], amount: 1000 * k });
    expect(debts).toHaveLength(10);
    const simplified = simplifyDebts(debts);
    expect(simplified.length).toBeLessThanOrEqual(4); // at most (people − 1) payments
    const before = net(debts), after = net(simplified);
    for (const id of ids) expect(after.get(id) ?? 0, id).toBe(before.get(id) ?? 0);
  });
});
