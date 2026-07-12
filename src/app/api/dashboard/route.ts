import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, handleError } from "@/lib/api-helpers";
import { formatCurrency } from "@/lib/utils";
import { subMonths, startOfMonth, format } from "date-fns";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await ensureUserProfile(user!.id, user!.email!);
    const userId = user!.id;
    const sixMonthsAgo = subMonths(new Date(), 6);

    const [
      mySplits,       // splits on expenses I didn't pay (I owe)
      myPaidSplits,   // splits on expenses I paid (others owe me)
      groups,
      recentActivity,
    ] = await Promise.all([
      // Splits I owe (expenses paid by someone else)
      prisma.expenseSplit.findMany({
        where: { userId, expense: { paidById: { not: userId }, date: { gte: sixMonthsAgo } } },
        include: { expense: { select: { date: true, paidById: true, paidBy: { select: { name: true, avatarUrl: true } } } } },
      }),
      // Splits others owe me (expenses I paid)
      prisma.expenseSplit.findMany({
        where: { userId: { not: userId }, expense: { paidById: userId, date: { gte: sixMonthsAgo } } },
        include: { expense: { select: { date: true } }, user: { select: { name: true, avatarUrl: true } } },
      }),
      prisma.group.count({ where: { members: { some: { userId } } } }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
    ]);

    // ── Totals ──────────────────────────────────────────────
    const totalOwing = mySplits.reduce((s, x) => s + x.amount, 0);
    const totalOwed  = myPaidSplits.reduce((s, x) => s + x.amount, 0);

    // ── Monthly chart (last 6 months) ───────────────────────
    const months: { month: string; owed: number; owing: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const label = format(start, "MMM");
      const monthKey = format(start, "yyyy-MM");

      const owed = myPaidSplits
        .filter((s) => format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount / 100, 0);

      const owing = mySplits
        .filter((s) => format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount / 100, 0);

      months.push({ month: label, owed, owing });
    }

    // ── Per-person balances ──────────────────────────────────
    const balanceMap = new Map<string, { name: string; avatarUrl: string | null; net: number }>();

    for (const split of myPaidSplits) {
      const uid = split.userId;
      const cur = balanceMap.get(uid) ?? { name: split.user.name, avatarUrl: split.user.avatarUrl, net: 0 };
      cur.net += split.amount;
      balanceMap.set(uid, cur);
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

    return ok({
      stats: {
        totalOwed,
        totalOwing,
        groupCount: groups,
        netBalance: totalOwed - totalOwing,
      },
      monthly: months,
      personBalances,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        metadata: a.metadata,
        user: a.user,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
