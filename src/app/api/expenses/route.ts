import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit } from "@/lib/api-helpers";
import { createExpenseSchema } from "@/lib/validations/expense";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const cursor = searchParams.get("cursor");

    const expenses = await prisma.expense.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        splits: { some: { userId: user!.id } },
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
        group: true,
      },
      orderBy: { date: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return ok(expenses);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimit(ip, 30)) return err("Too many requests", 429);

  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();
    const data = createExpenseSchema.parse(body);

    // Validate group membership if groupId provided
    if (data.groupId) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: data.groupId, userId: user!.id } },
      });
      if (!member) return err("Not a member of this group", 403);
    }

    // Calculate split amounts (stored in cents)
    const totalCents = toCents(data.amount);
    const splitAmounts = calculateSplits(
      totalCents,
      data.participants,
      data.splitType,
      data.splits
    );

    const expense = await prisma.expense.create({
      data: {
        description: data.description,
        amount: totalCents,
        currency: data.currency,
        category: data.category,
        splitType: data.splitType,
        paidById: data.paidById,
        groupId: data.groupId ?? null,
        date: data.date,
        notes: data.notes ?? null,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval ?? null,
        splits: {
          create: data.participants.map((uid) => ({
            userId: uid,
            amount: splitAmounts[uid] ?? 0,
            percentage: data.splitType === "PERCENTAGE" ? (data.splits?.[uid] ?? 0) : null,
            shares: data.splitType === "SHARES" ? (data.splits?.[uid] ?? 0) : null,
          })),
        },
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
        group: true,
      },
    });

    // Notify participants (skip the payer)
    const notifyIds = data.participants.filter((id) => id !== data.paidById);
    if (notifyIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyIds.map((uid) => ({
          userId: uid,
          type: "EXPENSE_ADDED" as const,
          title: `${expense.paidBy.name} added an expense`,
          body: `${data.description} — you owe $${(splitAmounts[uid] ?? 0) / 100}`,
          data: { expenseId: expense.id },
        })),
      });
    }

    await prisma.activity.create({
      data: {
        type: "EXPENSE_CREATED",
        userId: user!.id,
        groupId: data.groupId ?? null,
        expenseId: expense.id,
        metadata: { description: data.description, amount: totalCents },
      },
    });

    return ok(expense, 201);
  } catch (e) {
    return handleError(e);
  }
}
