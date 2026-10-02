import { requireAuth, ok, handleError, visibleToUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    const [allExpenses, allSettlements] = await Promise.all([
      prisma.expense.findMany({
        where: visibleToUser(userId),
        select: { paidById: true, currency: true, splits: { select: { userId: true, amount: true } } },
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { fromUserId: true, toUserId: true, amount: true, currency: true },
      }),
    ]);

    // Net balance per (person, currency): positive = they owe me, negative = I owe them.
    // Currencies are never mixed, so each one is netted and simplified on its own.
    const nets = new Map<string, Map<string, number>>(); // currency -> personId -> net
    const bump = (currency: string, personId: string, amount: number) => {
      const byPerson = nets.get(currency) ?? new Map<string, number>();
      byPerson.set(personId, (byPerson.get(personId) ?? 0) + amount);
      nets.set(currency, byPerson);
    };
    for (const expense of allExpenses) {
      for (const split of expense.splits) {
        if (split.userId === userId && expense.paidById !== userId) bump(expense.currency, expense.paidById, -split.amount);
        else if (expense.paidById === userId && split.userId !== userId) bump(expense.currency, split.userId, split.amount);
      }
    }
    for (const s of allSettlements) {
      if (s.fromUserId === userId) bump(s.currency, s.toUserId, s.amount);
      else bump(s.currency, s.fromUserId, -s.amount);
    }

    // Look up names for all involved users
    const peerIds = [...new Set([...nets.values()].flatMap((m) => [...m.keys()]))];
    const peers = peerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: peerIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const peerMap = new Map(peers.map((p) => [p.id, p]));
    const unknown = (id: string) => ({ id, name: "Unknown", avatarUrl: null });

    const simplified = [...nets.entries()].flatMap(([currency, byPerson]) => {
      const rawDebts = [...byPerson.entries()]
        .filter(([, amt]) => amt !== 0)
        .map(([otherId, amt]) =>
          amt < 0
            ? { fromUserId: userId, toUserId: otherId, amount: -amt }
            : { fromUserId: otherId, toUserId: userId, amount: amt }
        );
      return simplifyDebts(rawDebts).map((d) => ({
        ...d,
        currency,
        fromUser: peerMap.get(d.fromUserId) ?? unknown(d.fromUserId),
        toUser: peerMap.get(d.toUserId) ?? unknown(d.toUserId),
      }));
    });

    const res = ok({ simplified });
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
