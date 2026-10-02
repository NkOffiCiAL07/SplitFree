import { describe, it, expect } from "vitest";
import {
  expensePayments, expenseEdges, settlementEdge, buildEdges, pairNets, groupNets, userNet, validatePayers,
  type LedgerExpense,
} from "@/lib/ledger";

const exp = (over: Partial<LedgerExpense> & Pick<LedgerExpense, "splits">): LedgerExpense => ({
  paidById: "a", currency: "INR", amount: 0, groupId: null, ...over,
});

describe("expensePayments", () => {
  it("defaults to the single payer paying everything", () => {
    expect(expensePayments(exp({ amount: 900, splits: [] }))).toEqual([{ userId: "a", amount: 900 }]);
  });
  it("uses explicit payers when present", () => {
    const payers = [{ userId: "a", amount: 600 }, { userId: "b", amount: 300 }];
    expect(expensePayments(exp({ amount: 900, splits: [], payers }))).toEqual(payers);
  });
});

describe("expenseEdges — single payer", () => {
  it("makes each splitter owe the payer, skipping the payer's own share", () => {
    const edges = expenseEdges(exp({ amount: 900, splits: [{ userId: "a", amount: 300 }, { userId: "b", amount: 300 }, { userId: "c", amount: 300 }] }));
    expect(edges.map((e) => [e.fromUserId, e.toUserId, e.amount])).toEqual([["b", "a", 300], ["c", "a", 300]]);
  });
  it("produces nothing when the payer is the only participant", () => {
    expect(expenseEdges(exp({ amount: 500, splits: [{ userId: "a", amount: 500 }] }))).toEqual([]);
  });
});

describe("expenseEdges — multiple payers", () => {
  it("settles up paid-vs-share across payers (A pays 600, B pays 300, split equally 3 ways)", () => {
    const edges = expenseEdges(exp({
      amount: 900,
      payers: [{ userId: "a", amount: 600 }, { userId: "b", amount: 300 }],
      splits: [{ userId: "a", amount: 300 }, { userId: "b", amount: 300 }, { userId: "c", amount: 300 }],
    }));
    // net: a +300, b 0, c −300 → c owes a 300, b is square
    expect(edges.map((e) => [e.fromUserId, e.toUserId, e.amount])).toEqual([["c", "a", 300]]);
  });

  it("every person's overall net equals paid − share, with exact integers", () => {
    const e = exp({
      amount: 1000,
      payers: [{ userId: "a", amount: 700 }, { userId: "b", amount: 300 }],
      splits: [{ userId: "c", amount: 334 }, { userId: "d", amount: 333 }, { userId: "e", amount: 333 }],
    });
    const edges = expenseEdges(e);
    const net = (u: string) => userNet(edges, u).get("INR") ?? 0;
    expect(net("a")).toBe(700);
    expect(net("b")).toBe(300);
    expect(net("c")).toBe(-334);
    expect(net("d")).toBe(-333);
    expect(net("e")).toBe(-333);
    expect(edges.every((x) => Number.isInteger(x.amount) && x.amount > 0)).toBe(true);
  });

  it("a payer who overpaid relative to their share is owed by the others", () => {
    const edges = expenseEdges(exp({
      amount: 1000,
      payers: [{ userId: "a", amount: 800 }, { userId: "b", amount: 200 }],
      splits: [{ userId: "a", amount: 500 }, { userId: "b", amount: 500 }],
    }));
    expect(edges.map((e) => [e.fromUserId, e.toUserId, e.amount])).toEqual([["b", "a", 300]]);
  });
});

describe("settlements and pair balances", () => {
  it("models a settlement as a counter-debt", () => {
    expect(settlementEdge({ fromUserId: "b", toUserId: "a", amount: 100, currency: "INR" })).toMatchObject({ fromUserId: "a", toUserId: "b", amount: 100, kind: "settlement" });
  });

  it("pairNets nets expenses against settlements per person and currency from my side", () => {
    const edges = buildEdges(
      [exp({ amount: 1000, splits: [{ userId: "a", amount: 500 }, { userId: "b", amount: 500 }] })],
      [{ fromUserId: "b", toUserId: "a", amount: 200, currency: "INR" }]
    );
    expect(pairNets(edges, "a").get("b")?.get("INR")).toBe(300); // b still owes a 300
    expect(pairNets(edges, "b").get("a")?.get("INR")).toBe(-300); // from b's side: owes a 300
  });

  it("drops exactly-settled pairs and never mixes currencies", () => {
    const edges = buildEdges(
      [exp({ amount: 1000, splits: [{ userId: "b", amount: 500 }] }), exp({ amount: 1000, currency: "USD", splits: [{ userId: "b", amount: 100 }] })],
      [{ fromUserId: "b", toUserId: "a", amount: 500, currency: "INR" }]
    );
    const nets = pairNets(edges, "a").get("b")!;
    expect(nets.has("INR")).toBe(false);
    expect(nets.get("USD")).toBe(100);
  });

  it("works for multi-payer expenses from either payer's perspective", () => {
    const edges = buildEdges([exp({
      amount: 900, payers: [{ userId: "a", amount: 600 }, { userId: "b", amount: 300 }],
      splits: [{ userId: "a", amount: 300 }, { userId: "b", amount: 300 }, { userId: "c", amount: 300 }],
    })], []);
    expect(pairNets(edges, "c").get("a")?.get("INR")).toBe(-300);
    expect(pairNets(edges, "b").size).toBe(0);
  });
});

describe("groupNets", () => {
  it("nets per group and ignores expenses without a group", () => {
    const edges = buildEdges([
      exp({ id: "1", groupId: "g1", amount: 1000, splits: [{ userId: "a", amount: 500 }, { userId: "b", amount: 500 }] }),
      exp({ id: "2", groupId: null, amount: 1000, splits: [{ userId: "b", amount: 1000 }] }),
    ], []);
    const g = groupNets(edges, "a");
    expect(g.get("g1")?.get("INR")).toBe(500);
    expect(g.size).toBe(1);
  });
});

describe("validatePayers", () => {
  it("accepts payers that add up", () => {
    expect(validatePayers([{ userId: "a", amount: 600 }, { userId: "b", amount: 400 }], 1000)).toBeNull();
  });
  it("rejects a single payer, duplicates, non-positive or non-integer amounts, and wrong sums", () => {
    expect(validatePayers([{ userId: "a", amount: 1000 }], 1000)).toMatch(/at least two/i);
    expect(validatePayers([{ userId: "a", amount: 500 }, { userId: "a", amount: 500 }], 1000)).toMatch(/once/i);
    expect(validatePayers([{ userId: "a", amount: 1000 }, { userId: "b", amount: 0 }], 1000)).toMatch(/paid something/i);
    expect(validatePayers([{ userId: "a", amount: 500.5 }, { userId: "b", amount: 499.5 }], 1000)).toMatch(/paid something/i);
    expect(validatePayers([{ userId: "a", amount: 500 }, { userId: "b", amount: 400 }], 1000)).toMatch(/add up/i);
  });
});
