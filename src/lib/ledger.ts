/**
 * The single source of truth for "who owes whom".
 *
 * An expense is a set of payments (who put money in) and a set of splits (who consumed it).
 * Each person's net for the expense is `paid − share`; people with a negative net owe the people
 * with a positive net. Settlements are modelled as counter-debts. Every balance screen
 * (dashboard, balances, settle, friend page, group page) is derived from these edges, so adding a
 * feature like multiple payers only has to be handled here.
 */

export interface LedgerExpense {
  id?: string;
  paidById: string;
  currency: string;
  amount: number; // cents
  groupId?: string | null;
  date?: Date | string;
  category?: string;
  splits: { userId: string; amount: number }[];
  /** Present only for multi-payer expenses; empty/undefined means `paidById` paid it all */
  payers?: { userId: string; amount: number }[];
}

export interface LedgerSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  groupId?: string | null;
}

/** "from owes to" — a debt created by an expense, or (negative direction) cleared by a settlement. */
export interface Edge {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  groupId: string | null;
  kind: "expense" | "settlement";
  expenseId?: string;
  date?: Date | string;
}

/** Who actually paid, and how much. */
export function expensePayments(e: LedgerExpense): { userId: string; amount: number }[] {
  return e.payers && e.payers.length > 0 ? e.payers : [{ userId: e.paidById, amount: e.amount }];
}

/**
 * Debts created by one expense. With a single payer this is simply "each splitter owes the payer";
 * with several payers, debtors (paid < share) are matched to creditors (paid > share) in order,
 * which keeps every amount an exact integer and every person's total correct.
 */
export function expenseEdges(e: LedgerExpense): Edge[] {
  const base = { currency: e.currency, groupId: e.groupId ?? null, kind: "expense" as const, expenseId: e.id, date: e.date };
  const payments = expensePayments(e);

  if (payments.length === 1) {
    const payer = payments[0].userId;
    return e.splits
      .filter((s) => s.userId !== payer && s.amount !== 0)
      .map((s) => ({ ...base, fromUserId: s.userId, toUserId: payer, amount: s.amount }));
  }

  const net = new Map<string, number>();
  for (const p of payments) net.set(p.userId, (net.get(p.userId) ?? 0) + p.amount);
  for (const s of e.splits) net.set(s.userId, (net.get(s.userId) ?? 0) - s.amount);

  const debtors = [...net.entries()].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }));
  const creditors = [...net.entries()].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }));
  const edges: Edge[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    edges.push({ ...base, fromUserId: debtors[i].id, toUserId: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return edges;
}

/** A settlement "from pays to" reduces from's debt, i.e. it is a debt in the opposite direction. */
export function settlementEdge(s: LedgerSettlement): Edge {
  return { fromUserId: s.toUserId, toUserId: s.fromUserId, amount: s.amount, currency: s.currency, groupId: s.groupId ?? null, kind: "settlement" };
}

export function buildEdges(expenses: LedgerExpense[], settlements: LedgerSettlement[]): Edge[] {
  return [...expenses.flatMap(expenseEdges), ...settlements.map(settlementEdge)];
}

/**
 * Net per counterparty and currency from `me`'s point of view:
 * positive = they owe me, negative = I owe them. Zero balances are dropped.
 */
export function pairNets(edges: Edge[], me: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const bump = (other: string, currency: string, amount: number) => {
    const byCurrency = out.get(other) ?? new Map<string, number>();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
    out.set(other, byCurrency);
  };
  for (const e of edges) {
    if (e.toUserId === me && e.fromUserId !== me) bump(e.fromUserId, e.currency, e.amount);
    else if (e.fromUserId === me && e.toUserId !== me) bump(e.toUserId, e.currency, -e.amount);
  }
  for (const [other, byCurrency] of out) {
    for (const [cur, v] of byCurrency) if (v === 0) byCurrency.delete(cur);
    if (byCurrency.size === 0) out.delete(other);
  }
  return out;
}

/** Net per group and currency for `me` (positive = owed to me). */
export function groupNets(edges: Edge[], me: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const e of edges) {
    if (!e.groupId) continue;
    const delta = e.toUserId === me && e.fromUserId !== me ? e.amount : e.fromUserId === me && e.toUserId !== me ? -e.amount : 0;
    if (delta === 0) continue;
    const byCurrency = out.get(e.groupId) ?? new Map<string, number>();
    byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + delta);
    out.set(e.groupId, byCurrency);
  }
  return out;
}

/** Everyone's overall net position (paid − owed) per currency, e.g. for "can this member leave?". */
export function userNet(edges: Edge[], userId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of edges) {
    if (e.toUserId === userId) out.set(e.currency, (out.get(e.currency) ?? 0) + e.amount);
    if (e.fromUserId === userId) out.set(e.currency, (out.get(e.currency) ?? 0) - e.amount);
  }
  return out;
}

/** Validates multi-payer input: positive amounts, no duplicates, sum equals the expense total (cents). */
export function validatePayers(payers: { userId: string; amount: number }[], totalCents: number): string | null {
  if (payers.length < 2) return "Add at least two payers, or use a single payer";
  if (new Set(payers.map((p) => p.userId)).size !== payers.length) return "Each payer can only appear once";
  if (payers.some((p) => !Number.isInteger(p.amount) || p.amount <= 0)) return "Every payer must have paid something";
  const sum = payers.reduce((a, p) => a + p.amount, 0);
  if (sum !== totalCents) return "Payer amounts must add up to the total";
  return null;
}

export interface CurrencyNet { currency: string; net: number }

/** Net for one expense between `me` and `other`: positive = other owes me. */
export function expenseDeltaBetween(e: LedgerExpense, me: string, other: string): number {
  let delta = 0;
  for (const edge of expenseEdges(e)) {
    if (edge.toUserId === me && edge.fromUserId === other) delta += edge.amount;
    else if (edge.fromUserId === me && edge.toUserId === other) delta -= edge.amount;
  }
  return delta;
}
