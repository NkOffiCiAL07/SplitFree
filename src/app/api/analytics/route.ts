import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { format, startOfMonth, subMonths } from "date-fns";

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const sixMonthsAgo = subMonths(startOfMonth(new Date()), 5);

    const [expenses, settlements, groups] = await Promise.all([
      prisma.expense.findMany({
        where: {
          splits: { some: { userId: user!.id } },
          date: { gte: sixMonthsAgo },
        },
        include: { splits: { where: { userId: user!.id } } },
        orderBy: { date: "asc" },
      }),
      prisma.settlement.findMany({
        where: {
          OR: [{ fromUserId: user!.id }, { toUserId: user!.id }],
          createdAt: { gte: sixMonthsAgo },
        },
      }),
      prisma.group.findMany({
        where: { members: { some: { userId: user!.id } } },
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

    // Balance
    const totalOwed = settlements
      .filter((s) => s.toUserId === user!.id)
      .reduce((sum, s) => sum + s.amount, 0);
    const totalOwing = settlements
      .filter((s) => s.fromUserId === user!.id)
      .reduce((sum, s) => sum + s.amount, 0);

    return ok({
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
      categoryTotals,
      totalExpenses: expenses.reduce((s, e) => s + (e.splits[0]?.amount ?? 0), 0),
      totalOwed,
      totalOwing,
      groupCount: groups.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
