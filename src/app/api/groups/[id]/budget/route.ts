import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { toCents } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

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
    const [budgets, monthlySpending] = await Promise.all([
      prisma.budget.findMany({
        where: { groupId, userId: user!.id },
      }),
      prisma.expense.aggregate({
        where: {
          groupId,
          splits: { some: { userId: user!.id } },
          date: { gte: startOfMonth(now), lte: endOfMonth(now) },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalSpent = monthlySpending._sum.amount ?? 0;

    return ok({ budgets, totalSpentThisMonth: totalSpent });
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

    const budget = await prisma.budget.upsert({
      where: {
        userId_groupId_category: {
          userId: user!.id,
          groupId,
          category: category ?? null,
        },
      },
      update: { amount: amountCents, period },
      create: { userId: user!.id, groupId, category: category ?? null, amount: amountCents, period },
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
