import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    const [allExpenses, allSettlements] = await Promise.all([
      prisma.expense.findMany({
        where: { splits: { some: { userId } } },
        select: { paidById: true, splits: { select: { userId: true, amount: true } } },
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { fromUserId: true, toUserId: true, amount: true },
      }),
    ]);

    // Build net balances: positive = they owe me, negative = I owe them
    const netMap = new Map<string, number>();
    for (const expense of allExpenses) {
      for (const split of expense.splits) {
        if (split.userId === userId && expense.paidById !== userId) {
          netMap.set(expense.paidById, (netMap.get(expense.paidById) ?? 0) - split.amount);
        } else if (expense.paidById === userId && split.userId !== userId) {
          netMap.set(split.userId, (netMap.get(split.userId) ?? 0) + split.amount);
        }
      }
    }
    for (const s of allSettlements) {
      if (s.fromUserId === userId) {
        netMap.set(s.toUserId, (netMap.get(s.toUserId) ?? 0) + s.amount);
      } else {
        netMap.set(s.fromUserId, (netMap.get(s.fromUserId) ?? 0) - s.amount);
      }
    }

    // Collect raw debts for simplification (only non-zero)
    const rawDebts = Array.from(netMap.entries())
      .filter(([, amt]) => amt !== 0)
      .map(([otherId, amt]) =>
        amt < 0
          ? { fromUserId: userId, toUserId: otherId, amount: -amt }
          : { fromUserId: otherId, toUserId: userId, amount: amt }
      );

    // Look up names for all involved users
    const peerIds = Array.from(netMap.keys());
    const peers = peerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: peerIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const peerMap = new Map(peers.map((p) => [p.id, p]));

    const simplified = simplifyDebts(rawDebts).map((d) => ({
      ...d,
      fromUser: peerMap.get(d.fromUserId) ?? { id: d.fromUserId, name: "Unknown", avatarUrl: null },
      toUser: peerMap.get(d.toUserId) ?? { id: d.toUserId, name: "Unknown", avatarUrl: null },
    }));

    const res = ok({ simplified, netMap: Object.fromEntries(netMap) });
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
