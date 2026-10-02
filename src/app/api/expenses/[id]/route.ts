import { createNotifications } from "@/lib/notify";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, visibleToUser, getKnownUserIds, isGroupArchived, ARCHIVED_MESSAGE } from "@/lib/api-helpers";
import { updateExpenseSchema } from "@/lib/validations/expense";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents } from "@/lib/utils";
import { validatePayers } from "@/lib/ledger";
import { snapshotExpense, diffSnapshots } from "@/lib/revisions";

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
      where: { id, ...visibleToUser(user!.id) },
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
      where: { id, ...visibleToUser(user!.id) },
      include: { splits: true, payers: true },
    });
    if (!existing) return err("Expense not found", 404);
    if (existing.groupId && (await isGroupArchived(existing.groupId))) return err(ARCHIVED_MESSAGE, 409);

    // Group expenses: any member can edit. Personal expenses: only a payer.
    const isPayer = existing.paidById === user!.id || existing.payers.some((p) => p.userId === user!.id);
    if (!isPayer && existing.groupId) {
      const memberCheck = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: existing.groupId, userId: user!.id } },
      });
      if (!memberCheck) return err("Not authorized to edit this expense", 403);
    } else if (!isPayer && !existing.groupId) {
      return err("Only the payer can edit this expense", 403);
    }

    const body = await req.json();
    const data = updateExpenseSchema.parse({ ...body, id });

    const totalCents = data.amount ? toCents(data.amount) : existing.amount;
    const amountChanged = totalCents !== existing.amount;
    const splitType = data.splitType ?? existing.splitType;
    const participants = data.participants ?? existing.splits.map((x) => x.userId);

    // Payers: undefined = unchanged, null/[] = back to a single payer, 2+ = multiple payers
    const payersTouched = data.payers !== undefined;
    let payersCents: { userId: string; amount: number }[];
    if (payersTouched) {
      payersCents = (data.payers ?? []).map((p) => ({ userId: p.userId, amount: toCents(p.amount) }));
    } else {
      payersCents = existing.payers.map((p) => ({ userId: p.userId, amount: p.amount }));
      if (payersCents.length > 0 && amountChanged) {
        return err("Provide the payers again when changing the total of a multi-payer expense", 400);
      }
    }
    if (payersCents.length > 0) {
      const problem = validatePayers(payersCents, totalCents);
      if (problem) return err(problem, 400);
    }
    const paidById = payersCents.length > 0
      ? [...payersCents].sort((a, b) => b.amount - a.amount)[0].userId
      : data.paidById ?? existing.paidById;

    // Splits must be rebuilt whenever anything that feeds them changes
    const rebuildSplits = amountChanged || !!data.participants || !!data.splitType || !!data.splits;

    if (rebuildSplits || data.paidById || payersTouched) {
      let allowed: Set<string>;
      if (existing.groupId) {
        const members = await prisma.groupMember.findMany({ where: { groupId: existing.groupId }, select: { userId: true } });
        allowed = new Set(members.map((m) => m.userId));
      } else {
        allowed = await getKnownUserIds(user!.id);
      }
      // People already on the expense stay valid even if they have since left the group
      existing.splits.forEach((x) => allowed.add(x.userId));
      existing.payers.forEach((x) => allowed.add(x.userId));
      allowed.add(existing.paidById);
      if ([paidById, ...payersCents.map((p) => p.userId), ...participants].some((uid) => !allowed.has(uid))) {
        return err("All participants must be members of the group", 403);
      }
    }

    // Overrides (in dollars/percent/shares) — fall back to the stored values
    let overrides = data.splits;
    if (rebuildSplits && !overrides) {
      if (splitType === "PERCENTAGE") {
        overrides = Object.fromEntries(existing.splits.map((x) => [x.userId, x.percentage ?? 0]));
      } else if (splitType === "SHARES") {
        overrides = Object.fromEntries(existing.splits.map((x) => [x.userId, x.shares ?? 1]));
      } else if (splitType === "EXACT" && amountChanged) {
        return err("Provide the per-person amounts when changing the total of an exact split", 400);
      } else if (splitType === "EXACT") {
        overrides = Object.fromEntries(existing.splits.map((x) => [x.userId, x.amount / 100]));
      }
    }
    const splitAmounts = rebuildSplits ? calculateSplits(totalCents, participants, splitType, overrides) : {};

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        description: data.description,
        amount: totalCents,
        category: data.category,
        date: data.date,
        notes: data.notes,
        paidById,
        splitType,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval, // undefined = unchanged, null = clear
        ...(payersTouched
          ? { payers: { deleteMany: {}, ...(payersCents.length > 0 ? { create: payersCents } : {}) } }
          : {}),
        ...(rebuildSplits
          ? {
              splits: {
                deleteMany: {},
                create: participants.map((uid) => ({
                  userId: uid,
                  amount: splitAmounts[uid] ?? 0,
                  percentage: splitType === "PERCENTAGE" ? (overrides?.[uid] ?? 0) : null,
                  shares: splitType === "SHARES" ? (overrides?.[uid] ?? 0) : null,
                })),
              },
            }
          : {}),
      },
      include: { paidBy: true, splits: { include: { user: true } }, payers: { include: { user: true } }, group: true },
    });

    // Edit history: store what changed (before → after) so it can be shown on the expense
    const changes = diffSnapshots(snapshotExpense(existing), snapshotExpense(updated));
    if (Object.keys(changes).length > 0) {
      await prisma.expenseRevision.create({ data: { expenseId: id, userId: user!.id, changes: changes as unknown as Prisma.InputJsonObject } });
    }

    // Notify all group members (except editor) about the update
    const notifyIds = await getGroupMemberIds(existing.groupId, user!.id);
    if (notifyIds.length > 0) {
      const editor = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });
      const editorName = editor?.name ?? user!.email ?? "Someone";
      await createNotifications(notifyIds.map((uid) => ({
          userId: uid,
          type: "EXPENSE_UPDATED" as const,
          title: `${editorName} updated an expense`,
          body: `"${updated.description}" was edited`,
          data: { expenseId: id, groupId: existing.groupId },
        })));
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
      where: { id, ...visibleToUser(user!.id) },
      include: { paidBy: true },
    });
    if (!expense) return err("Expense not found", 404);
    if (expense.groupId && (await isGroupArchived(expense.groupId))) return err(ARCHIVED_MESSAGE, 409);

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
      await createNotifications(notifyIds.map((uid) => ({
          userId: uid,
          type: "EXPENSE_DELETED" as const,
          title: `${editorName} deleted an expense`,
          body: `"${expense.description}" was removed`,
          data: { groupId: expense.groupId },
        })));
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
