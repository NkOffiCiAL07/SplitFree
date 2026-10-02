export interface StatsExpense {
  amount: number; // cents
  currency: string;
  category: string;
  paidById: string;
  splits: { userId: string; amount: number }[];
}

export interface GroupStats {
  /** Currency the figures below are in: the one with the most spending (never mixed) */
  currency: string;
  total: number;
  yourShare: number;
  yourPaid: number;
  expenseCount: number;
  byCategory: { category: string; total: number }[];
  byMember: { userId: string; paid: number; share: number }[];
  /** Spending in any other currency, reported separately instead of being added in */
  otherCurrencies: { currency: string; total: number }[];
}

/**
 * Spending summary for a group (Splitwise Pro "totals", free here).
 * Amounts in different currencies are never summed: the dominant currency is detailed,
 * the rest are listed with their totals only.
 */
export function computeGroupStats(expenses: StatsExpense[], userId: string): GroupStats {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const currency = ranked[0]?.[0] ?? "INR";

  const main = expenses.filter((e) => e.currency === currency);
  const categories = new Map<string, number>();
  const members = new Map<string, { paid: number; share: number }>();
  const member = (id: string) => {
    const m = members.get(id) ?? { paid: 0, share: 0 };
    members.set(id, m);
    return m;
  };

  let yourShare = 0;
  let yourPaid = 0;
  for (const e of main) {
    categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);
    member(e.paidById).paid += e.amount;
    if (e.paidById === userId) yourPaid += e.amount;
    for (const s of e.splits) {
      member(s.userId).share += s.amount;
      if (s.userId === userId) yourShare += s.amount;
    }
  }

  return {
    currency,
    total: totals.get(currency) ?? 0,
    yourShare,
    yourPaid,
    expenseCount: main.length,
    byCategory: [...categories.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
    byMember: [...members.entries()].map(([id, v]) => ({ userId: id, ...v })).sort((a, b) => b.paid - a.paid),
    otherCurrencies: ranked.slice(1).map(([cur, total]) => ({ currency: cur, total })),
  };
}
