import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { toCents } from "@/lib/utils";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import type { ExpenseCategory } from "@prisma/client";

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
    const spentFor = async (period: string, category: string | null) => {
      const agg = await prisma.expenseSplit.aggregate({
        where: {
          userId: user!.id,
          expense: {
            groupId,
            date: rangeFor(period),
            ...(category ? { category: category as ExpenseCategory } : {}),
          },
        },
        _sum: { amount: true },
      });
      return agg._sum.amount ?? 0;
    };

    const withSpent = await Promise.all(
      budgets.map(async (b) => ({ ...b, spent: await spentFor(b.period, b.category) }))
    );
    const totalSpent = await spentFor("MONTHLY", null);

    return ok({ budgets: withSpent, totalSpentThisMonth: totalSpent });
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
