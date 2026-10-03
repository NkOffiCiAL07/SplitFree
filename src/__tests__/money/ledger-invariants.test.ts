import { describe, it, expect } from "vitest";
import { buildEdges, pairNets, userNet, type LedgerExpense, type LedgerSettlement } from "@/lib/ledger";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";

function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const USERS = ["a", "b", "c", "d", "e", "f"];
const CURRENCIES = ["INR", "USD", "EUR"];

function world(seed: number) {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const some = (min: number) => { const k = min + Math.floor(r() * (USERS.length - min + 1)); return [...USERS].sort(() => r() - 0.5).slice(0, k); };
  const expenses: LedgerExpense[] = [];
  for (let i = 0; i < 60; i++) {
    const total = 1 + Math.floor(r() * 2_000_000);
    const participants = some(1);
    const type = pick(["EQUAL", "SHARES", "PERCENTAGE", "EXACT"] as const);
    let overrides: Record<string, number> | undefined;
    if (type === "SHARES") overrides = Object.fromEntries(participants.map((p) => [p, 1 + Math.floor(r() * 4)]));
    if (type === "PERCENTAGE") {
      const w = participants.map(() => 1 + Math.floor(r() * 9)), t = w.reduce((a, b) => a + b, 0);
      const pct = w.map((x) => Math.floor((x / t) * 10000) / 100);
      pct[0] = Math.round((100 - pct.slice(1).reduce((a, b) => a + b, 0)) * 100) / 100;
      overrides = Object.fromEntries(participants.map((p, k) => [p, pct[k]]));
    }
    if (type === "EXACT") {
      const eq = calculateSplits(total, participants, "EQUAL");
      overrides = Object.fromEntries(participants.map((p) => [p, eq[p] / 100]));
    }
    const splits = calculateSplits(total, participants, type, overrides);
    const splitRows = Object.entries(splits).map(([userId, amount]) => ({ userId, amount }));

    const multi = r() < 0.4;
    let payers: { userId: string; amount: number }[] | undefined;
    let paidById = pick(USERS);
    if (multi) {
      const ps = some(2).slice(0, 2 + Math.floor(r() * 3));
      const cut = ps.map(() => r() + 0.1), cs = cut.reduce((a, b) => a + b, 0);
      const amounts = cut.map((c) => Math.floor((c / cs) * total));
      amounts[0] += total - amounts.reduce((a, b) => a + b, 0);
      payers = ps.map((userId, k) => ({ userId, amount: amounts[k] })).filter((p) => p.amount > 0);
      if (payers.reduce((s, p) => s + p.amount, 0) !== total) payers = undefined;
      else paidById = payers[0].userId;
    }
    expenses.push({ id: `e${i}`, paidById, currency: pick(CURRENCIES), amount: total, splits: splitRows, payers });
  }
  const settlements: LedgerSettlement[] = [];
  for (let i = 0; i < 25; i++) {
    const from = pick(USERS); let to = pick(USERS); while (to === from) to = pick(USERS);
    settlements.push({ fromUserId: from, toUserId: to, amount: 1 + Math.floor(r() * 500_000), currency: pick(CURRENCIES) });
  }
  return { expenses, settlements };
}

describe.each(Array.from({ length: 25 }, (_, i) => i + 1))("ledger invariants (random world %i)", (seed) => {
  const { expenses, settlements } = world(seed);
  const edges = buildEdges(expenses, settlements);

  it("every edge is a positive whole number of cents between two different people", () => {
    for (const e of edges) {
      expect(Number.isInteger(e.amount)).toBe(true);
      expect(e.amount).toBeGreaterThan(0);
      expect(e.fromUserId).not.toBe(e.toUserId);
    }
  });

  it("money is conserved: in every currency, everyone's net positions add up to exactly zero", () => {
    for (const cur of CURRENCIES) {
      const total = USERS.reduce((s, u) => s + (userNet(edges, u).get(cur) ?? 0), 0);
      expect(total, cur).toBe(0);
    }
  });

  it("each person's net equals paid − share + settlements sent − received, computed independently", () => {
    for (const u of USERS) for (const cur of CURRENCIES) {
      let expected = 0;
      for (const e of expenses.filter((x) => x.currency === cur)) {
        const paid = (e.payers && e.payers.length ? e.payers : [{ userId: e.paidById, amount: e.amount }]).filter((p) => p.userId === u).reduce((s, p) => s + p.amount, 0);
        const share = e.splits.filter((s) => s.userId === u).reduce((s, x) => s + x.amount, 0);
        expected += paid - share;
      }
      for (const s of settlements.filter((x) => x.currency === cur)) {
        if (s.fromUserId === u) expected += s.amount;
        if (s.toUserId === u) expected -= s.amount;
      }
      expect(userNet(edges, u).get(cur) ?? 0, `${u} ${cur}`).toBe(expected);
    }
  });

  it("balances are mirror images: what A is owed by B is exactly what B owes A", () => {
    for (const a of USERS) for (const b of USERS) {
      if (a === b) continue;
      for (const cur of CURRENCIES) {
        const ab = pairNets(edges, a).get(b)?.get(cur) ?? 0;
        const ba = pairNets(edges, b).get(a)?.get(cur) ?? 0;
        expect(ab, `${a}/${b} ${cur}`).toBe(ba === 0 ? 0 : -ba); // (avoids JS's -0 ≠ 0)
      }
    }
  });

  it("paying exactly what you owe someone brings that pair to zero and changes nobody else", () => {
    const [a, b] = ["a", "b"];
    for (const cur of CURRENCIES) {
      const owed = pairNets(edges, a).get(b)?.get(cur) ?? 0; // >0: b owes a
      if (owed === 0) continue;
      const payer = owed > 0 ? b : a, payee = owed > 0 ? a : b;
      const after = buildEdges(expenses, [...settlements, { fromUserId: payer, toUserId: payee, amount: Math.abs(owed), currency: cur }]);
      expect(pairNets(after, a).get(b)?.get(cur) ?? 0).toBe(0);
      for (const u of USERS.filter((x) => x !== a && x !== b))
        expect(userNet(after, u).get(cur) ?? 0).toBe(userNet(edges, u).get(cur) ?? 0);
    }
  });
});

describe("a replayed settlement is not double-counted", () => {
  it("the ledger only ever sees the one saved record", () => {
    const e = [{ id: "e1", paidById: "a", currency: "INR", amount: 1000, splits: [{ userId: "a", amount: 500 }, { userId: "b", amount: 500 }] }];
    const once = pairNets(buildEdges(e, [{ fromUserId: "b", toUserId: "a", amount: 500, currency: "INR" }]), "a");
    expect(once.size).toBe(0);
  });
});
