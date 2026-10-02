import type { Expense } from "@/types";

/** Cents a given user put in for this expense (alone, or as one of several payers). */
export function paidBy(expense: Pick<Expense, "paidById" | "amount" | "payers">, userId: string): number {
  if (expense.payers && expense.payers.length > 1) return expense.payers.find((p) => p.userId === userId)?.amount ?? 0;
  return expense.paidById === userId ? expense.amount : 0;
}

/**
 * The user's net position on one expense in cents: what they paid minus what they consumed.
 * Positive = they are owed (lent), negative = they owe, null = not involved.
 */
export function netForUser(
  expense: Pick<Expense, "paidById" | "amount" | "payers" | "splits">,
  userId: string
): number | null {
  const share = expense.splits?.find((s) => s.userId === userId)?.amount ?? 0;
  const paid = paidBy(expense, userId);
  if (share === 0 && paid === 0) return null;
  return paid - share;
}

/** "Asha" for a single payer, "Asha, Bhanu" for several. */
export function payersLabel(expense: Pick<Expense, "paidBy" | "payers">): string {
  if (expense.payers && expense.payers.length > 1) {
    return expense.payers.map((p) => p.user?.name?.split(" ")[0] ?? "Someone").join(", ");
  }
  return expense.paidBy?.name ?? "Unknown";
}
