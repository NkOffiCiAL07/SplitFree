import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, handleError } from "@/lib/api-helpers";
import { subMonths, startOfMonth, format } from "date-fns";
import { NextResponse } from "next/server";
import { loadConverter, sumInHome } from "@/lib/convert";
import { withActivityCurrency } from "@/lib/activity-currency";
import { loadUserLedger, loadPeople } from "@/lib/ledger-db";
import { pairNets } from "@/lib/ledger";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);
    const userId = user!.id;

    // Totals/balances are all-time (they must match /api/balances); only the chart is limited to 6 months.
    const [ledger, groups, recentActivity, profile] = await Promise.all([
      loadUserLedger(userId),
      prisma.group.count({ where: { members: { some: { userId } }, archivedAt: null } }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, type: true, metadata: true, createdAt: true, settlementId: true,
          expense: { select: { currency: true } },
          user: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    ]);
    const { edges } = ledger;

    // Headline currency = the user's home currency from Settings. (It used to be overridden by the most
    // recently updated group's currency, which made the setting do nothing for most people.)
    const currency = profile?.currency ?? DEFAULT_CURRENCY;

    // Everything is summarised in the home currency: other currencies are converted at live rates (approximate,
    // and flagged as such). Debts themselves stay exact per currency in the balance lists below.
    const nonHome = edges.some((e) => e.currency !== currency);
    const conv = await loadConverter(currency, nonHome);

    // Monthly chart, built from expense-created debts (settlements are not "spending"), accumulated in cents.
    const months: { month: string; owed: number; owing: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const monthKey = format(start, "yyyy-MM");
      let owedCents = 0;
      let owingCents = 0;
      for (const e of edges) {
        if (e.kind !== "expense" || !e.date) continue;
        if (format(new Date(e.date), "yyyy-MM") !== monthKey) continue;
        const inHome = conv.toHome(e.amount, e.currency);
        if (inHome === null) continue; // no rate for this currency: left out (flagged via stats.incomplete)
        if (e.toUserId === userId) owedCents += inHome;
        else if (e.fromUserId === userId) owingCents += inHome;
      }
      months.push({ month: format(start, "MMM"), owed: owedCents / 100, owing: owingCents / 100 });
    }

    // Per-person, per-currency balances (net > 0 means they owe you, < 0 means you owe them)
    const nets = pairNets(edges, userId);
    const people = await loadPeople([...nets.keys()]);
    const balanceRows = [...nets.entries()].flatMap(([id, byCurrency]) =>
      [...byCurrency.entries()].map(([cur, net]) => ({
        id,
        name: people.get(id)?.name ?? "Unknown",
        avatarUrl: people.get(id)?.avatarUrl ?? null,
        currency: cur,
        net,
      }))
    );

    // Totals per currency, derived from settlement-adjusted per-person balances
    const totalsByCurrency = new Map<string, { owed: number; owing: number }>();
    for (const b of balanceRows) {
      const t = totalsByCurrency.get(b.currency) ?? { owed: 0, owing: 0 };
      if (b.net > 0) t.owed += b.net;
      else if (b.net < 0) t.owing += -b.net;
      totalsByCurrency.set(b.currency, t);
    }
    const main = totalsByCurrency.get(currency) ?? { owed: 0, owing: 0 };
    const otherCurrencies = [...totalsByCurrency.entries()]
      .filter(([cur, t]) => cur !== currency && (t.owed > 0 || t.owing > 0))
      .map(([cur, t]) => ({ currency: cur, owed: t.owed, owing: t.owing }));

    // Headline totals in the home currency (other currencies converted; approximate when any were)
    const owedTotal = sumInHome([...totalsByCurrency.entries()].map(([c, t]) => ({ amount: t.owed, currency: c })), conv);
    const owingTotal = sumInHome([...totalsByCurrency.entries()].map(([c, t]) => ({ amount: t.owing, currency: c })), conv);
    const approximate = owedTotal.approximate || owingTotal.approximate;
    const incomplete = !owedTotal.complete || !owingTotal.complete;
    const combined = otherCurrencies.length > 0 && conv.date
      ? { owed: owedTotal.total, owing: owingTotal.total, net: owedTotal.total - owingTotal.total, date: conv.date, complete: !incomplete }
      : null;

    const personBalances = balanceRows
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5);

    const body = JSON.stringify({
      data: {
        stats: {
          totalOwed: owedTotal.total, totalOwing: owingTotal.total, groupCount: groups, netBalance: owedTotal.total - owingTotal.total,
          approximate, incomplete, rateDate: approximate ? conv.date : "",
          homeOnly: { owed: main.owed, owing: main.owing },
          otherCurrencies, combined,
        },
        monthly: months,
        personBalances,
        recentActivity: await withActivityCurrency(recentActivity),
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
