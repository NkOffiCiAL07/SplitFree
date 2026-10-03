import { toCents } from "@/lib/utils";
import type { Debt } from "@/types";

/** The caller sent a split that can't be applied (maps to HTTP 400 — retrying the same request can never succeed). */
export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitError";
  }
}

/**
 * Simplifies a list of debts using the "minimum cash flow" algorithm.
 * Reduces the number of transactions needed to settle all debts.
 *
 * O(n²) — acceptable for typical group sizes (< 50 members).
 */
export function simplifyDebts(debts: Debt[]): Debt[] {
  // Build net balance map: positive = owed to you, negative = you owe
  const balances = new Map<string, number>();

  for (const debt of debts) {
    balances.set(debt.fromUserId, (balances.get(debt.fromUserId) ?? 0) - debt.amount);
    balances.set(debt.toUserId, (balances.get(debt.toUserId) ?? 0) + debt.amount);
  }

  // Separate creditors (positive) and debtors (negative)
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of balances) {
    if (balance > 0) creditors.push({ id, amount: balance });
    else if (balance < 0) debtors.push({ id, amount: -balance });
  }

  // Greedily match debtors to creditors
  const result: Debt[] = [];
  let i = 0; // creditors index
  let j = 0; // debtors index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settlement = Math.min(creditor.amount, debtor.amount);

    result.push({
      fromUserId: debtor.id,
      toUserId: creditor.id,
      amount: settlement,
    });

    creditor.amount -= settlement;
    debtor.amount -= settlement;

    if (creditor.amount === 0) i++;
    if (debtor.amount === 0) j++;
  }

  return result;
}

/**
 * Calculates how much each participant owes given a split type.
 * Returns a map of userId -> amount in cents.
 */
/**
 * Splits `totalCents` between `participants`. Invariants (enforced here, fuzz-tested): every share is a whole,
 * non-negative number of cents and the shares add up to `totalCents` EXACTLY — money is never created or lost.
 * Anything that can't satisfy that (amounts a cent off, negative entries, entries for non-participants) throws.
 */
export function calculateSplits(
  totalCents: number,
  participants: string[],
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES",
  overrides?: Record<string, number>,
  /** Smallest legal step of the currency in stored units (1 normally; 100 for yen, which has no sub-unit) */
  unit = 1
): Record<string, number> {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new SplitError("Total must be a positive amount");
  if (participants.length === 0) throw new SplitError("At least one participant required");
  if (new Set(participants).size !== participants.length) throw new SplitError("A participant is listed twice");
  if (totalCents % unit !== 0) throw new SplitError("This currency has no fractional amounts — use a whole number");

  // Work in whole units of the currency (yen), then scale back: every share is then a legal amount too
  const total = totalCents / unit;
  const scale = (r: Record<string, number>) => (unit === 1 ? r : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * unit])));
  const result: Record<string, number> = {};

  if (splitType === "EQUAL") {
    const perPerson = Math.floor(total / participants.length);
    const remainder = total - perPerson * participants.length;
    participants.forEach((id, idx) => {
      result[id] = perPerson + (idx === 0 ? remainder : 0);
    });
    return scale(result);
  }

  if (!overrides) {
    throw new SplitError(
      splitType === "EXACT" ? "EXACT split requires per-user amounts"
        : splitType === "PERCENTAGE" ? "PERCENTAGE split requires percentages"
        : "SHARES split requires share counts"
    );
  }
  const allowed = new Set(participants);
  for (const [id, v] of Object.entries(overrides)) {
    if (!Number.isFinite(v) || v < 0) throw new SplitError("Split values can't be negative");
    if (!allowed.has(id) && v !== 0) throw new SplitError("Split includes someone who isn't a participant");
  }
  const valueOf = (id: string) => overrides[id] ?? 0;

  if (splitType === "EXACT") {
    for (const id of participants) {
      const cents = toCents(valueOf(id));
      if (cents % unit !== 0) throw new SplitError("This currency has no fractional amounts — use whole numbers");
      result[id] = cents / unit;
    }
    if (Object.values(result).reduce((a, b) => a + b, 0) !== total) throw new SplitError("Exact amounts don't add up to total");
    return scale(result);
  }

  const totalWeight = participants.reduce((sum, id) => sum + valueOf(id), 0);
  if (splitType === "PERCENTAGE" && Math.abs(totalWeight - 100) > 0.01) throw new SplitError("Percentages must sum to 100");
  if (splitType === "SHARES" && totalWeight === 0) throw new SplitError("Total shares cannot be zero");
  return scale(allocateProportionally(total, participants, valueOf, totalWeight));
}

/**
 * Largest-remainder allocation: everyone gets the floor of their exact share, then the leftover cents go to
 * whoever lost the most to flooring. Always non-negative, always sums to the total, a zero weight always gets zero.
 */
function allocateProportionally(
  totalCents: number,
  participants: string[],
  weightOf: (id: string) => number,
  totalWeight: number
): Record<string, number> {
  const rows = participants.map((id, order) => {
    const exact = (totalCents * weightOf(id)) / totalWeight;
    const floor = Math.floor(exact + 1e-9); // 1e-9: float noise must not drop a whole cent
    return { id, order, floor, frac: exact - floor, eligible: weightOf(id) > 0 };
  });
  let leftover = totalCents - rows.reduce((sum, r) => sum + r.floor, 0);
  const byRemainder = rows.filter((r) => r.eligible).sort((x, y) => y.frac - x.frac || x.order - y.order);
  for (let i = 0; leftover > 0 && byRemainder.length > 0; i++, leftover--) byRemainder[i % byRemainder.length].floor += 1;
  return Object.fromEntries(rows.map((r) => [r.id, r.floor]));
}

/** Returns net balance for a user across all expenses and settlements */
export function computeNetBalance(
  userId: string,
  expenses: Array<{
    paidById: string;
    splits: Array<{ userId: string; amount: number }>;
  }>,
  settlements: Array<{ fromUserId: string; toUserId: string; amount: number }>
): number {
  let balance = 0;

  for (const expense of expenses) {
    // Amount paid
    if (expense.paidById === userId) {
      balance += expense.splits.reduce((sum, s) => sum + s.amount, 0);
    }
    // Amount owed by you
    const myShare = expense.splits.find((s) => s.userId === userId);
    if (myShare) balance -= myShare.amount;
  }

  // Settlements: fromUserId = payer/debtor, toUserId = receiver/creditor
  for (const s of settlements) {
    if (s.fromUserId === userId) balance += s.amount; // I paid someone → my debt reduces
    if (s.toUserId === userId) balance -= s.amount;   // Someone paid me → I'm owed less
  }

  return balance;
}
