import { expensePayments } from "@/lib/ledger";
import { makeConverter, type Converter } from "@/lib/convert-core";

export interface StatsExpense {
  amount: number; // cents
  currency: string;
  category: string;
  paidById: string;
  splits: { userId: string; amount: number }[];
  /** Multi-payer expenses: who paid how much (otherwise paidById paid it all) */
  payers?: { userId: string; amount: number }[];
}

export interface GroupStats {
  /** Currency the figures below are in (the viewer's home currency; other currencies are converted into it) */
  currency: string;
  /** True when some spending was converted from another currency (so the figures are approximate) */
  approximate: boolean;
  /** Exchange-rate date used for the conversion ("" when nothing was converted) */
  rateDate: string;
  total: number;
  yourShare: number;
  yourPaid: number;
  expenseCount: number;
  byCategory: { category: string; total: number }[];
  byMember: { userId: string; paid: number; share: number }[];
  /** Spending that could NOT be converted (no exchange rate), reported in its own currency instead of being dropped */
  otherCurrencies: { currency: string; total: number }[];
}

/**
 * Spending summary for a group (Splitwise Pro "totals", free here).
 * With a converter, spending in every currency is expressed in the home currency (approximate, flagged). Without one,
 * the currency with the most spending is detailed and the rest are listed separately — amounts in different
 * currencies are never added together as raw numbers. Anything that can't be converted is listed, never dropped.
 */
export function computeGroupStats(expenses: StatsExpense[], userId: string, conv?: Converter): GroupStats {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const c = conv ?? makeConverter(ranked[0]?.[0] ?? "INR", null);
  const currency = c.home;

  const categories = new Map<string, number>();
  const members = new Map<string, { paid: number; share: number }>();
  const member = (id: string) => {
    const m = members.get(id) ?? { paid: 0, share: 0 };
    members.set(id, m);
    return m;
  };

  let total = 0;
  let yourShare = 0;
  let yourPaid = 0;
  let counted = 0;
  let approximate = false;
  const skipped = new Map<string, number>();
  for (const e of expenses) {
    const inHome = c.toHome(e.amount, e.currency);
    if (inHome === null) {
      skipped.set(e.currency, (skipped.get(e.currency) ?? 0) + e.amount);
      continue;
    }
    if (e.currency !== currency) approximate = true;
    counted++;
    total += inHome;
    categories.set(e.category, (categories.get(e.category) ?? 0) + inHome);
    for (const p of expensePayments(e)) {
      const v = c.toHome(p.amount, e.currency) ?? 0;
      member(p.userId).paid += v;
      if (p.userId === userId) yourPaid += v;
    }
    for (const s of e.splits) {
      const v = c.toHome(s.amount, e.currency) ?? 0;
      member(s.userId).share += v;
      if (s.userId === userId) yourShare += v;
    }
  }

  return {
    currency,
    approximate,
    rateDate: approximate ? c.date : "",
    total,
    yourShare,
    yourPaid,
    expenseCount: counted,
    byCategory: [...categories.entries()].map(([category, t]) => ({ category, total: t })).sort((a, b) => b.total - a.total),
    byMember: [...members.entries()].map(([id, v]) => ({ userId: id, ...v })).sort((a, b) => b.paid - a.paid),
    otherCurrencies: [...skipped.entries()].map(([cur, t]) => ({ currency: cur, total: t })).sort((a, b) => b.total - a.total),
  };
}
