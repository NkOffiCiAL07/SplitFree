import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { updateExpenseSchema } from "@/lib/validations/expense";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents } from "@/lib/utils";

async function getGroupMemberIds(groupId: string | null, excludeId: string): Promise<string[]> {
  if (!groupId) return [];
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return members.map((m) => m.userId).filter((id) => id !== excludeId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, splits: { some: { userId: user!.id } } },
      include: { paidBy: true, splits: { include: { user: true } }, group: true },
    });
    if (!expense) return err("Expense not found", 404);
    return ok(expense);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const existing = await prisma.expense.findFirst({
      where: { id, splits: { some: { userId: user!.id } } },
    });
    if (!existing) return err("Expense not found", 404);

    // Group expenses: any member can edit. Personal expenses: only payer.
    if (existing.paidById !== user!.id && existing.groupId) {
      const memberCheck = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: existing.groupId, userId: user!.id } },
      });
      if (!memberCheck) return err("Not authorized to edit this expense", 403);
    } else if (existing.paidById !== user!.id && !existing.groupId) {
      return err("Only the payer can edit this expense", 403);
    }

    const body = await req.json();
    const data = updateExpenseSchema.parse({ ...body, id });

    const totalCents = data.amount ? toCents(data.amount) : existing.amount;
    const participants = data.participants ?? [];

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        description: data.description,
        amount: totalCents,
        category: data.category,
        date: data.date,
        notes: data.notes,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval ?? null,
        ...(participants.length > 0 && data.splitType
          ? {
              splits: (() => {
              const splitAmounts = calculateSplits(totalCents, participants, data.splitType!, data.splits);
              return {
                deleteMany: {},
                create: participants.map((uid) => ({
                  userId: uid,
                  amount: splitAmounts[uid] ?? 0,
                  percentage: data.splitType === "PERCENTAGE" ? (data.splits?.[uid] ?? 0) : null,
                  shares: data.splitType === "SHARES" ? (data.splits?.[uid] ?? 0) : null,
                })),
              };
            })(),
            }
          : {}),
      },
      include: { paidBy: true, splits: { include: { user: true } }, group: true },
    });

    // Notify all group members (except editor) about the update
    const notifyIds = await getGroupMemberIds(existing.groupId, user!.id);
    if (notifyIds.length > 0) {
      const editor = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });
      const editorName = editor?.name ?? user!.email ?? "Someone";
      await prisma.notification.createMany({
        data: notifyIds.map((uid) => ({
          userId: uid,
          type: "EXPENSE_UPDATED" as const,
          title: `${editorName} updated an expense`,
          body: `"${updated.description}" was edited`,
          data: { expenseId: id, groupId: existing.groupId },
        })),
        skipDuplicates: true,
      });
    }

    await prisma.activity.create({
      data: {
        type: "EXPENSE_UPDATED",
        userId: user!.id,
        expenseId: id,
        groupId: existing.groupId,
        metadata: { description: updated.description },
      },
    });

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, splits: { some: { userId: user!.id } } },
      include: { paidBy: true },
    });
    if (!expense) return err("Expense not found", 404);

    // Group expenses: any member can delete. Personal expenses: only payer.
    if (expense.paidById !== user!.id && expense.groupId) {
      const memberCheck = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: expense.groupId, userId: user!.id } },
      });
      if (!memberCheck) return err("Not authorized to delete this expense", 403);
    } else if (expense.paidById !== user!.id && !expense.groupId) {
      return err("Only the payer can delete this expense", 403);
    }

    // Fetch group members before deleting (cascade will remove related data)
    const notifyIds = await getGroupMemberIds(expense.groupId, user!.id);

    await prisma.expense.delete({ where: { id } });

    if (notifyIds.length > 0) {
      const editor = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });
      const editorName = editor?.name ?? user!.email ?? "Someone";
      await prisma.notification.createMany({
        data: notifyIds.map((uid) => ({
          userId: uid,
          type: "EXPENSE_DELETED" as const,
          title: `${editorName} deleted an expense`,
          body: `"${expense.description}" was removed`,
          data: { groupId: expense.groupId },
        })),
        skipDuplicates: true,
      });
    }

    await prisma.activity.create({
      data: {
        type: "EXPENSE_DELETED",
        userId: user!.id,
        groupId: expense.groupId,
        metadata: { description: expense.description },
      },
    });

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
