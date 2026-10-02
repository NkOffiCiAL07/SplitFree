import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, handleError } from "@/lib/api-helpers";
import { subMonths, startOfMonth, format } from "date-fns";
import { NextResponse } from "next/server";
import { getRates, convertToBase } from "@/lib/rates";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await ensureUserProfile(user!.id, user!.email!);
    const userId = user!.id;
    
    // Totals/balances are all-time (they must match /api/balances); only the chart is limited to 6 months.
    const [mySplits, myPaidSplits, groups, recentActivity, profile, primaryGroup, mySettlements] = await Promise.all([
      prisma.expenseSplit.findMany({
        where: { userId, expense: { paidById: { not: userId } } },
        select: {
          amount: true,
          expense: {
            select: {
              date: true,
              currency: true,
              paidById: true,
              paidBy: { select: { name: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.expenseSplit.findMany({
        where: { userId: { not: userId }, expense: { paidById: userId } },
        select: {
          amount: true,
          userId: true,
          expense: { select: { date: true, currency: true } },
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
      // Most recently updated group to detect preferred currency
      prisma.group.findFirst({
        where: { members: { some: { userId } } },
        orderBy: { updatedAt: "desc" },
        select: { currency: true },
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: {
          fromUserId: true, toUserId: true, amount: true, currency: true,
          fromUser: { select: { name: true, avatarUrl: true } },
          toUser: { select: { name: true, avatarUrl: true } },
        },
      }),
    ]);

    // Headline currency: group currency takes priority over the profile default
    const currency = primaryGroup?.currency ?? profile?.currency ?? DEFAULT_CURRENCY;

    // Monthly chart — primary currency only (amounts in different currencies are never summed),
    // bucketed in memory but accumulated in cents, divided once per bucket
    const months: { month: string; owed: number; owing: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const monthKey = format(start, "yyyy-MM");

      const owedCents  = myPaidSplits
        .filter((s) => s.expense.currency === currency && format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount, 0);

      const owingCents = mySplits
        .filter((s) => s.expense.currency === currency && format(s.expense.date, "yyyy-MM") === monthKey)
        .reduce((sum, s) => sum + s.amount, 0);

      months.push({ month: format(start, "MMM"), owed: owedCents / 100, owing: owingCents / 100 });
    }

    // Per-person, per-currency balances (net > 0 means they owe you, < 0 means you owe them)
    const balanceMap = new Map<string, { id: string; name: string; avatarUrl: string | null; currency: string; net: number }>();
    const bump = (id: string, name: string, avatarUrl: string | null, cur: string, amount: number) => {
      const key = `${id}|${cur}`;
      const entry = balanceMap.get(key) ?? { id, name, avatarUrl, currency: cur, net: 0 };
      entry.net += amount;
      balanceMap.set(key, entry);
    };
    for (const split of myPaidSplits) bump(split.userId, split.user.name, split.user.avatarUrl, split.expense.currency, split.amount);
    for (const split of mySplits) bump(split.expense.paidById, split.expense.paidBy.name, split.expense.paidBy.avatarUrl, split.expense.currency, -split.amount);
    for (const s of mySettlements) {
      // I paid them → my debt shrinks; they paid me → what they owe me shrinks
      if (s.fromUserId === userId) bump(s.toUserId, s.toUser.name, s.toUser.avatarUrl, s.currency, s.amount);
      else bump(s.fromUserId, s.fromUser.name, s.fromUser.avatarUrl, s.currency, -s.amount);
    }

    // Totals per currency, derived from settlement-adjusted per-person balances
    const totalsByCurrency = new Map<string, { owed: number; owing: number }>();
    for (const b of balanceMap.values()) {
      const t = totalsByCurrency.get(b.currency) ?? { owed: 0, owing: 0 };
      if (b.net > 0) t.owed += b.net;
      else if (b.net < 0) t.owing += -b.net;
      totalsByCurrency.set(b.currency, t);
    }
    const main = totalsByCurrency.get(currency) ?? { owed: 0, owing: 0 };
    const otherCurrencies = [...totalsByCurrency.entries()]
      .filter(([cur, t]) => cur !== currency && (t.owed > 0 || t.owing > 0))
      .map(([cur, t]) => ({ currency: cur, owed: t.owed, owing: t.owing }));

    // Approximate combined total across currencies (live rates, best effort: omitted if unavailable)
    let combined: { owed: number; owing: number; net: number; date: string; complete: boolean } | null = null;
    if (otherCurrencies.length > 0) {
      const rates = await getRates(currency);
      if (rates) {
        let owed = main.owed;
        let owing = main.owing;
        let complete = true;
        for (const o of otherCurrencies) {
          const co = convertToBase(o.owed, o.currency, rates);
          const cw = convertToBase(o.owing, o.currency, rates);
          if (co === null || cw === null) { complete = false; continue; }
          owed += co;
          owing += cw;
        }
        combined = { owed, owing, net: owed - owing, date: rates.date, complete };
      }
    }

    const personBalances = [...balanceMap.values()]
      .filter((b) => b.net !== 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5);

    const body = JSON.stringify({
      data: {
        stats: { totalOwed: main.owed, totalOwing: main.owing, groupCount: groups, netBalance: main.owed - main.owing, otherCurrencies, combined },
        monthly: months,
        personBalances,
        recentActivity,
        currency,
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
