export interface RecurringLike {
  amount: number; // cents
  currency: string;
  recurringInterval?: string | null;
}

/** Cost of one occurrence scaled to a month (weekly ≈ 4.33 weeks, yearly ÷ 12). */
export function monthlyEquivalent(amount: number, interval?: string | null): number {
  switch (interval) {
    case "DAILY": return amount * 30;
    case "WEEKLY": return amount * 4.33;
    case "YEARLY": return amount / 12;
    case "MONTHLY":
    default: return amount;
  }
}

/** Estimated monthly cost of recurring expenses, per currency — currencies are never added together. */
export function monthlyByCurrency(expenses: RecurringLike[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + monthlyEquivalent(e.amount, e.recurringInterval));
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);
}
