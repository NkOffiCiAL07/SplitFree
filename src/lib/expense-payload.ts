import type { Expense } from "@/types";

/**
 * Rebuilds the POST /api/expenses body from a stored expense (used by Duplicate and Undo-delete).
 * Stored splits are in cents; the API expects dollars for EXACT, percent for PERCENTAGE and
 * share counts for SHARES, so non-equal splits are converted back instead of being dropped.
 */
export function expenseToCreatePayload(
  expense: Expense,
  overrides: { description?: string; date?: Date | string; isRecurring?: boolean } = {}
) {
  const splits = expense.splits ?? [];
  let splitValues: Record<string, number> | undefined;
  if (expense.splitType === "EXACT") {
    splitValues = Object.fromEntries(splits.map((s) => [s.userId, s.amount / 100]));
  } else if (expense.splitType === "PERCENTAGE") {
    splitValues = Object.fromEntries(splits.map((s) => [s.userId, s.percentage ?? 0]));
  } else if (expense.splitType === "SHARES") {
    splitValues = Object.fromEntries(splits.map((s) => [s.userId, s.shares ?? 1]));
  }

  return {
    description: overrides.description ?? expense.description,
    amount: expense.amount / 100,
    currency: expense.currency,
    category: expense.category,
    splitType: expense.splitType,
    paidById: expense.paidById,
    groupId: expense.groupId ?? null,
    date: overrides.date ?? expense.date,
    notes: expense.notes,
    isRecurring: overrides.isRecurring ?? expense.isRecurring,
    recurringInterval: expense.recurringInterval ?? null,
    participants: splits.map((s) => s.userId),
    // several payers: amounts back to major units
    ...(expense.payers && expense.payers.length > 1
      ? { payers: expense.payers.map((p) => ({ userId: p.userId, amount: p.amount / 100 })) }
      : {}),
    ...(splitValues ? { splits: splitValues } : {}),
  };
}
