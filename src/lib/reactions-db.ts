import { prisma } from "@/lib/prisma";
import { summarizeReactions, type ReactionSummary } from "@/lib/reactions";

/** One query for a whole page of expenses: id → its reactions (empty array when none). */
export async function loadReactionSummaries(expenseIds: string[], meId: string): Promise<Map<string, ReactionSummary[]>> {
  const out = new Map<string, ReactionSummary[]>();
  if (expenseIds.length === 0) return out;
  const rows = await prisma.expenseReaction.findMany({ where: { expenseId: { in: expenseIds } }, select: { expenseId: true, userId: true, emoji: true } });
  const grouped = new Map<string, { emoji: string; userId: string }[]>();
  for (const r of rows ?? []) grouped.set(r.expenseId, [...(grouped.get(r.expenseId) ?? []), { emoji: r.emoji, userId: r.userId }]);
  for (const id of expenseIds) out.set(id, summarizeReactions(grouped.get(id) ?? [], meId));
  return out;
}

/** Adds `reactions` to each expense of a list. */
export async function attachReactions<T extends { id: string }>(expenses: T[], meId: string): Promise<(T & { reactions: ReactionSummary[] })[]> {
  const summaries = await loadReactionSummaries(expenses.map((e) => e.id), meId);
  return expenses.map((e) => ({ ...e, reactions: summaries.get(e.id) ?? [] }));
}
