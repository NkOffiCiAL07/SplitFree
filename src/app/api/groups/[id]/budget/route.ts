import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { toCents } from "@/lib/utils";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { loadConverter } from "@/lib/convert";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!member) return err("Not a member of this group", 403);

    const now = new Date();
    const budgets = await prisma.budget.findMany({
      where: { groupId, userId: user!.id },
    });

    // Each budget is measured over its own period and category, using the user's own share
    const rangeFor = (period: string) => {
      switch (period) {
        case "WEEKLY": return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
        case "YEARLY": return { gte: startOfYear(now), lte: endOfYear(now) };
        default: return { gte: startOfMonth(now), lte: endOfMonth(now) };
      }
    };
    // A budget is in the group's currency. Spending in other currencies is converted into it (never added as raw
    // numbers); anything without a usable rate is reported in `skipped` instead of being silently ignored.
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { currency: true } });
    const budgetCurrency = group?.currency ?? "INR";
    const periods = [...new Set([...budgets.map((b) => b.period), "MONTHLY"])];
    const ranges = periods.map(rangeFor);
    const splits = await prisma.expenseSplit.findMany({
      where: {
        userId: user!.id,
        expense: {
          groupId,
          date: { gte: new Date(Math.min(...ranges.map((r) => r.gte.getTime()))), lte: new Date(Math.max(...ranges.map((r) => r.lte.getTime()))) },
        },
      },
      select: { amount: true, expense: { select: { currency: true, date: true, category: true } } },
    });
    const conv = await loadConverter(budgetCurrency, splits.some((x) => x.expense.currency !== budgetCurrency));
    const unconverted = new Set<number>(); // splits with no usable rate, each reported once however many budgets cover it
    const spentFor = (period: string, category: string | null) => {
      const range = rangeFor(period);
      let sum = 0;
      splits.forEach((x, i) => {
        const d = x.expense.date.getTime();
        if (d < range.gte.getTime() || d > range.lte.getTime()) return;
        if (category && x.expense.category !== category) return;
        const v = conv.toHome(x.amount, x.expense.currency);
        if (v === null) { unconverted.add(i); return; }
        sum += v;
      });
      return sum;
    };

    const withSpent = budgets.map((b) => ({ ...b, spent: spentFor(b.period, b.category) }));
    const totalSpent = spentFor("MONTHLY", null);
    const approximate = splits.some((x) => x.expense.currency !== budgetCurrency);
    const skippedByCurrency = new Map<string, number>();
    for (const i of unconverted) {
      const { amount, expense } = splits[i];
      skippedByCurrency.set(expense.currency, (skippedByCurrency.get(expense.currency) ?? 0) + amount);
    }
    const skipped = Array.from(skippedByCurrency, ([currency, amount]) => ({ currency, amount }));

    return ok({ budgets: withSpent, totalSpentThisMonth: totalSpent, currency: budgetCurrency, approximate, skipped });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!member) return err("Not a member of this group", 403);

    const { amount, category, period = "MONTHLY" } = await req.json();
    if (!amount || amount <= 0) return err("Invalid budget amount", 400);

    const amountCents = toCents(parseFloat(String(amount)));

    if (!["WEEKLY", "MONTHLY", "YEARLY"].includes(period)) return err("Invalid period", 400);

    // The unique key includes a nullable column and NULLs never collide in Postgres, so a plain
    // upsert would create duplicate "all categories" budgets — look the row up explicitly.
    const existing = await prisma.budget.findFirst({
      where: { userId: user!.id, groupId, category: category ?? null },
    });
    const budget = existing
      ? await prisma.budget.update({ where: { id: existing.id }, data: { amount: amountCents, period } })
      : await prisma.budget.create({
          data: { userId: user!.id, groupId, category: category ?? null, amount: amountCents, period },
        });

    return ok(budget, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;
    const { budgetId } = await req.json();

    await prisma.budget.deleteMany({
      where: { id: budgetId, userId: user!.id, groupId },
    });

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
