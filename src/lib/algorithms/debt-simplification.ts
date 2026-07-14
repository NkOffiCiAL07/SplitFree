import type { Debt } from "@/types";

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
export function calculateSplits(
  totalCents: number,
  participants: string[],
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES",
  overrides?: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};

  switch (splitType) {
    case "EQUAL": {
      const perPerson = Math.floor(totalCents / participants.length);
      const remainder = totalCents - perPerson * participants.length;
      participants.forEach((id, idx) => {
        result[id] = perPerson + (idx === 0 ? remainder : 0);
      });
      break;
    }

    case "EXACT": {
      if (!overrides) throw new Error("EXACT split requires per-user amounts");
      const total = Object.values(overrides).reduce((a, b) => a + b, 0);
      // overrides are in dollars, convert to cents
      if (Math.abs(total * 100 - totalCents) > 1)
        throw new Error("Exact amounts don't add up to total");
      participants.forEach((id) => {
        result[id] = Math.round((overrides[id] ?? 0) * 100);
      });
      break;
    }

    case "PERCENTAGE": {
      if (!overrides) throw new Error("PERCENTAGE split requires percentages");
      const totalPct = Object.values(overrides).reduce((a, b) => a + b, 0);
      if (Math.abs(totalPct - 100) > 0.01)
        throw new Error("Percentages must sum to 100");
      let allocatedPct = 0;
      participants.forEach((id, idx) => {
        if (idx === participants.length - 1) {
          result[id] = totalCents - allocatedPct;
        } else {
          result[id] = Math.round(totalCents * ((overrides[id] ?? 0) / 100));
          allocatedPct += result[id];
        }
      });
      break;
    }

    case "SHARES": {
      if (!overrides) throw new Error("SHARES split requires share counts");
      const totalShares = Object.values(overrides).reduce((a, b) => a + b, 0);
      if (totalShares === 0) throw new Error("Total shares cannot be zero");
      let allocatedShares = 0;
      participants.forEach((id, idx) => {
        if (idx === participants.length - 1) {
          result[id] = totalCents - allocatedShares;
        } else {
          result[id] = Math.round(totalCents * ((overrides[id] ?? 0) / totalShares));
          allocatedShares += result[id];
        }
      });
      break;
    }
  }

  return result;
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

  // Settlements
  for (const s of settlements) {
    if (s.fromUserId === userId) balance -= s.amount;
    if (s.toUserId === userId) balance += s.amount;
  }

  return balance;
}
