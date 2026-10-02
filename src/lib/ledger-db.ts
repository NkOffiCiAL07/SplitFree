import { prisma } from "@/lib/prisma";
import { buildEdges, type Edge, type LedgerExpense, type LedgerSettlement } from "@/lib/ledger";
import { visibleToUser } from "@/lib/api-helpers";

export const ledgerExpenseSelect = {
  id: true, paidById: true, currency: true, amount: true, groupId: true, date: true, category: true,
  splits: { select: { userId: true, amount: true } },
  payers: { select: { userId: true, amount: true } },
} as const;

/** Everything needed to compute a user's balances: every expense and settlement they are part of. */
export async function loadUserLedger(userId: string): Promise<{
  expenses: LedgerExpense[];
  settlements: LedgerSettlement[];
  edges: Edge[];
}> {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({ where: visibleToUser(userId), select: ledgerExpenseSelect }),
    prisma.settlement.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      select: { fromUserId: true, toUserId: true, amount: true, currency: true, groupId: true },
    }),
  ]);
  return { expenses, settlements, edges: buildEdges(expenses, settlements) };
}

/** Every expense and settlement in a group (all members), for group-wide simplification. */
export async function loadGroupLedger(groupId: string) {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({ where: { groupId }, select: ledgerExpenseSelect }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { fromUserId: true, toUserId: true, amount: true, currency: true, groupId: true },
    }),
  ]);
  return { expenses, settlements, edges: buildEdges(expenses, settlements) };
}

/** id → profile for the given users (one query). */
export async function loadPeople(ids: string[]) {
  if (ids.length === 0) return new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, avatarUrl: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}
