import { loadUserLedger } from "@/lib/ledger-db";
import { loadConverter, sumInHome } from "@/lib/convert";
import { pairNets } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { format, startOfMonth, subMonths } from "date-fns";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const sixMonthsAgo = subMonths(startOfMonth(new Date()), 5);

    const userId = user!.id;
    const profile = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
    const currency = profile?.currency ?? DEFAULT_CURRENCY;
    const [expenses, ledger, groups] = await Promise.all([
      prisma.expense.findMany({
        where: {
          splits: { some: { userId } },
          date: { gte: sixMonthsAgo },
        },
        include: { splits: { where: { userId } } },
        orderBy: { date: "asc" },
      }),
      loadUserLedger(userId),
      prisma.group.findMany({
        where: { members: { some: { userId } }, archivedAt: null }, // archived groups aren't active
        select: { id: true, name: true },
      }),
    ]);

    // All spending is expressed in the home currency: other currencies are converted at live rates, so nothing is
    // dropped and nothing is added up across currencies. Anything without a rate is reported, never silently lost.
    const nonHome = expenses.some((e) => e.currency !== currency) || ledger.edges.some((e) => e.currency !== currency);
    const conv = await loadConverter(currency, nonHome);
    const skipped = new Map<string, number>();
    let approximate = false;
    const myShareInHome = (exp: (typeof expenses)[number]) => {
      const share = exp.splits[0]?.amount ?? 0;
      const v = conv.toHome(share, exp.currency);
      if (v === null) { skipped.set(exp.currency, (skipped.get(exp.currency) ?? 0) + share); return 0; }
      if (exp.currency !== currency && share !== 0) approximate = true;
      return v;
    };

    // Monthly spending grouped
    const monthlyMap = new Map<string, { total: number; byCategory: Record<string, number> }>();
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(new Date(), i), "yyyy-MM");
      monthlyMap.set(key, { total: 0, byCategory: {} });
    }

    const categoryTotals: Record<string, number> = {};
    let totalExpenses = 0;
    expenses.forEach((exp) => {
      const myShare = myShareInHome(exp);
      totalExpenses += myShare;
      categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + myShare;
      const entry = monthlyMap.get(format(exp.date, "yyyy-MM"));
      if (!entry) return;
      entry.total += myShare;
      entry.byCategory[exp.category] = (entry.byCategory[exp.category] ?? 0) + myShare;
    });

    // Outstanding balance from the shared ledger, per currency, then expressed in the home currency
    const owedByCurrency = new Map<string, { owed: number; owing: number }>();
    for (const byCurrency of pairNets(ledger.edges, userId).values()) {
      for (const [cur, net] of byCurrency) {
        const t = owedByCurrency.get(cur) ?? { owed: 0, owing: 0 };
        if (net > 0) t.owed += net;
        else if (net < 0) t.owing += -net;
        owedByCurrency.set(cur, t);
      }
    }
    const owed = sumInHome([...owedByCurrency].map(([c, t]) => ({ amount: t.owed, currency: c })), conv);
    const owing = sumInHome([...owedByCurrency].map(([c, t]) => ({ amount: t.owing, currency: c })), conv);
    for (const s of [...owed.skipped, ...owing.skipped]) skipped.set(s.currency, (skipped.get(s.currency) ?? 0) + s.amount);
    approximate = approximate || owed.approximate || owing.approximate;

    const res = ok({
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
      categoryTotals,
      totalExpenses,
      totalOwed: owed.total,
      totalOwing: owing.total,
      groupCount: groups.length,
      currency,
      approximate,
      rateDate: approximate ? conv.date : "",
      /** Amounts left out because no exchange rate was available (empty normally) */
      skipped: [...skipped].map(([currency, amount]) => ({ currency, amount })),
    });
    res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
