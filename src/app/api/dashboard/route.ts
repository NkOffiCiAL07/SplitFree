import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, handleError } from "@/lib/api-helpers";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await ensureUserProfile(user!.id, user!.email!);
    const userId = user!.id;
    const sixMonthsAgo = subMonths(new Date(), 6);

    const [mySplits, myPaidSplits, groups, recentActivity, profile] = await Promise.all([
      prisma.expenseSplit.findMany({
        where: { userId, expense: { paidById: { not: userId }, date: { gte: sixMonthsAgo } } },
        select: {
          amount: true,
          expense: {
            select: {
              date: true,
              paidById: true,
              paidBy: { select: { name: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.expenseSplit.findMany({
        where: { userId: { not: userId }, expense: { paidById: userId, date: { gte: sixMonthsAgo } } },
        select: {
          amount: true,
          userId: true,
          expense: { select: { date: true } },
          user: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.group.count({ where: { members: { some: { userId } } } }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, type: true, metadata: true, createdAt: true,
          user: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    ]);

    // Totals (keep in cents until final output)
    const totalOwing = mySplits.reduce((s, x) => s + x.amount, 0);
    const totalOwed  = myPaidSplits.reduce((s, x) => s + x.amount, 0);

    // Monthly chart — bucket in memory but accumulate in cents, divide once per bucket
    const months: { month: string; owed: number; owing: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const monthKey = format(start, "yyyy-MM");

      const owedCents  = myPaidSplits
        .filter((s) => format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount, 0);

      const owingCents = mySplits
        .filter((s) => format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount, 0);

      months.push({ month: format(start, "MMM"), owed: owedCents / 100, owing: owingCents / 100 });
    }

    // Per-person balances
    const balanceMap = new Map<string, { name: string; avatarUrl: string | null; net: number }>();
    for (const split of myPaidSplits) {
      const cur = balanceMap.get(split.userId) ?? { name: split.user.name, avatarUrl: split.user.avatarUrl, net: 0 };
      cur.net += split.amount;
      balanceMap.set(split.userId, cur);
    }
    for (const split of mySplits) {
      const uid = split.expense.paidById;
      const cur = balanceMap.get(uid) ?? { name: split.expense.paidBy.name, avatarUrl: split.expense.paidBy.avatarUrl, net: 0 };
      cur.net -= split.amount;
      balanceMap.set(uid, cur);
    }
    const personBalances = Array.from(balanceMap.entries())
      .map(([id, b]) => ({ id, ...b }))
      .filter((b) => b.net !== 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5);

    const body = JSON.stringify({
      data: {
        stats: { totalOwed, totalOwing, groupCount: groups, netBalance: totalOwed - totalOwing },
        monthly: months,
        personBalances,
        recentActivity,
        currency: profile?.currency ?? "USD",
      },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
