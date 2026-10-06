import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, visibleToUser, tooManyRequests, isUniqueViolation } from "@/lib/api-helpers";
import { REACTIONS, summarizeReactions } from "@/lib/reactions";

const bodySchema = z.object({ emoji: z.enum(REACTIONS) });

async function currentSummary(expenseId: string, userId: string) {
  const rows = await prisma.expenseReaction.findMany({ where: { expenseId }, select: { emoji: true, userId: true } });
  return summarizeReactions(rows ?? [], userId);
}

/** Only people who can see an expense may react to it. */
async function canSee(expenseId: string, userId: string) {
  const e = await prisma.expense.findFirst({ where: { id: expenseId, ...visibleToUser(userId) }, select: { id: true } });
  return !!e;
}

// GET — the reactions on one expense
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;
    if (!(await canSee(id, user!.id))) return err("Expense not found", 404);
    return ok(await currentSummary(id, user!.id));
  } catch (e) {
    return handleError(e);
  }
}

// POST { emoji } — add your reaction, or take it back if you already gave that one (a toggle)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    { const limited = tooManyRequests(user!.id, "reaction", 120); if (limited) return limited; }
    const { id } = await params;
    const { emoji } = bodySchema.parse(await req.json());
    if (!(await canSee(id, user!.id))) return err("Expense not found", 404);

    const existing = await prisma.expenseReaction.findUnique({ where: { expenseId_userId_emoji: { expenseId: id, userId: user!.id, emoji } }, select: { id: true } });
    if (existing) {
      await prisma.expenseReaction.deleteMany({ where: { expenseId: id, userId: user!.id, emoji } });
    } else {
      try {
        await prisma.expenseReaction.create({ data: { expenseId: id, userId: user!.id, emoji } });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e; // two taps at once: the reaction is already there, which is what was asked
      }
    }
    return ok(await currentSummary(id, user!.id));
  } catch (e) {
    return handleError(e);
  }
}
