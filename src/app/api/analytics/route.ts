import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { loadUserLedger } from "@/lib/ledger-db";
import { pairNets } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError, visibleToUser } from "@/lib/api-helpers";
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
          currency, // amounts in other currencies are never summed with these
        },
        include: { splits: { where: { userId } } },
        orderBy: { date: "asc" },
      }),
      loadUserLedger(userId),
      prisma.group.findMany({
        where: { members: { some: { userId } } },
        select: { id: true, name: true },
      }),
    ]);

    // Monthly spending grouped
    const monthlyMap = new Map<string, { total: number; byCategory: Record<string, number> }>();
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(new Date(), i), "yyyy-MM");
      monthlyMap.set(key, { total: 0, byCategory: {} });
    }

    expenses.forEach((exp) => {
      const key = format(exp.date, "yyyy-MM");
      const entry = monthlyMap.get(key);
      if (!entry) return;
      const myShare = exp.splits[0]?.amount ?? 0;
      entry.total += myShare;
      entry.byCategory[exp.category] = (entry.byCategory[exp.category] ?? 0) + myShare;
    });

    // Category totals
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((exp) => {
      const myShare = exp.splits[0]?.amount ?? 0;
      categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + myShare;
    });

    // Outstanding balance (primary currency only) from the shared ledger
    let totalOwed = 0;
    let totalOwing = 0;
    for (const byCurrency of pairNets(ledger.edges, userId).values()) {
      const net = byCurrency.get(currency) ?? 0;
      if (net > 0) totalOwed += net;
      else if (net < 0) totalOwing += -net;
    }

    const res = ok({
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
      categoryTotals,
      totalExpenses: expenses.reduce((s, e) => s + (e.splits[0]?.amount ?? 0), 0),
      totalOwed,
      totalOwing,
      groupCount: groups.length,
      currency,
    });
    res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
