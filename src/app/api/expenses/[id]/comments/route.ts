import { createNotifications } from "@/lib/notify";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, visibleToUser } from "@/lib/api-helpers";

const MAX_COMMENT_LENGTH = 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: expenseId } = await params;

    // Verify user has access to this expense
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, ...visibleToUser(user!.id) },
    });
    if (!expense) return err("Expense not found", 404);

    const comments = await prisma.expenseComment.findMany({
      where: { expenseId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });

    return ok(comments);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: expenseId } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, ...visibleToUser(user!.id) },
      include: { paidBy: { select: { name: true } }, group: { select: { name: true } } },
    });
    if (!expense) return err("Expense not found", 404);

    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) return err("Comment text is required", 400);
    if (text.trim().length > MAX_COMMENT_LENGTH) return err(`Comments can be at most ${MAX_COMMENT_LENGTH} characters`, 400);

    const comment = await prisma.expenseComment.create({
      data: { expenseId, userId: user!.id, text: text.trim() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Notify all expense participants (except commenter)
    const participantIds = await prisma.expenseSplit.findMany({
      where: { expenseId, userId: { not: user!.id } },
      select: { userId: true },
    });

    const commenter = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });

    if (participantIds.length > 0) {
      await createNotifications(participantIds.map(({ userId }) => ({
          userId,
          type: "EXPENSE_COMMENTED" as const,
          title: `${commenter?.name ?? "Someone"} commented on an expense`,
          body: `"${expense.description}": ${text.trim().slice(0, 80)}`,
          data: { expenseId, groupId: expense.groupId },
        })));
    }

    return ok(comment, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: expenseId } = await params;
    const { commentId } = await req.json();
    // An undefined id would be ignored by Prisma and match the user's first comment — reject it
    if (typeof commentId !== "string" || !commentId) return err("commentId is required", 400);

    const comment = await prisma.expenseComment.findFirst({
      where: { id: commentId, expenseId, userId: user!.id },
    });
    if (!comment) return err("Comment not found", 404);

    await prisma.expenseComment.delete({ where: { id: commentId } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
