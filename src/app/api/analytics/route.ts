import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { format, startOfMonth, subMonths } from "date-fns";

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const sixMonthsAgo = subMonths(startOfMonth(new Date()), 5);

    const userId = user!.id;
    const [expenses, allExpensesForBalance, allSettlements, groups] = await Promise.all([
      prisma.expense.findMany({
        where: {
          splits: { some: { userId } },
          date: { gte: sixMonthsAgo },
        },
        include: { splits: { where: { userId } } },
        orderBy: { date: "asc" },
      }),
      // All-time data for accurate outstanding balance
      prisma.expense.findMany({
        where: { splits: { some: { userId } } },
        select: { paidById: true, splits: { select: { userId: true, amount: true } } },
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { fromUserId: true, toUserId: true, amount: true },
      }),
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

    // Outstanding balance from expense splits + settlements
    const netMap = new Map<string, number>();
    for (const expense of allExpensesForBalance) {
      for (const split of expense.splits) {
        if (split.userId === userId && expense.paidById !== userId) {
          netMap.set(expense.paidById, (netMap.get(expense.paidById) ?? 0) - split.amount);
        } else if (expense.paidById === userId && split.userId !== userId) {
          netMap.set(split.userId, (netMap.get(split.userId) ?? 0) + split.amount);
        }
      }
    }
    for (const s of allSettlements) {
      if (s.fromUserId === userId) {
        netMap.set(s.toUserId, (netMap.get(s.toUserId) ?? 0) + s.amount);
      } else {
        netMap.set(s.fromUserId, (netMap.get(s.fromUserId) ?? 0) - s.amount);
      }
    }
    const totalOwed = Array.from(netMap.values()).filter((n) => n > 0).reduce((s, n) => s + n, 0);
    const totalOwing = Array.from(netMap.values()).filter((n) => n < 0).reduce((s, n) => s + Math.abs(n), 0);

    const res = ok({
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
      categoryTotals,
      totalExpenses: expenses.reduce((s, e) => s + (e.splits[0]?.amount ?? 0), 0),
      totalOwed,
      totalOwing,
      groupCount: groups.length,
    });
    res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
