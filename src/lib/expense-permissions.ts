/**
 * Only the person who added an expense can edit it (so nobody can quietly rewrite what someone else recorded).
 * Rows from before "added by" was tracked have no creator; for those the payer stands in.
 */
export function expenseOwnerId(e: { createdById?: string | null; paidById: string }): string {
  return e.createdById ?? e.paidById;
}

export function canEditExpense(e: { createdById?: string | null; paidById: string }, userId: string | undefined | null): boolean {
  return !!userId && expenseOwnerId(e) === userId;
}

export const NOT_EXPENSE_OWNER_MESSAGE = "Only the person who added this expense can edit it";
