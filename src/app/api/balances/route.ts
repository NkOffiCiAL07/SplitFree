import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    const [myPaidSplits, myOwedSplits, settlements] = await Promise.all([
      // Expenses I paid — others owe me
      prisma.expenseSplit.findMany({
        where: { expense: { paidById: userId }, userId: { not: userId } },
        select: {
          amount: true, userId: true,
          expense: { select: { groupId: true, currency: true } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      // Expenses others paid — I owe them
      prisma.expenseSplit.findMany({
        where: { userId, expense: { paidById: { not: userId } } },
        select: {
          amount: true,
          expense: {
            select: {
              groupId: true, currency: true,
              paidById: true,
              paidBy: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
      // Settlements involving me
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: {
          fromUserId: true, toUserId: true, amount: true, groupId: true, currency: true,
          fromUser: { select: { name: true, avatarUrl: true } },
          toUser: { select: { name: true, avatarUrl: true } },
        },
      }),
    ]);

    // ── Per-person balance, tracked separately per currency ─────────────
    // Amounts in different currencies are never added together.
    type Peer = { name: string; avatarUrl: string | null; nets: Map<string, number> };
    const personMap = new Map<string, Peer>();
    const bump = (id: string, name: string, avatarUrl: string | null, currency: string, amount: number) => {
      const peer = personMap.get(id) ?? { name, avatarUrl, nets: new Map<string, number>() };
      peer.nets.set(currency, (peer.nets.get(currency) ?? 0) + amount);
      personMap.set(id, peer);
    };

    for (const split of myPaidSplits) {
      bump(split.userId, split.user.name, split.user.avatarUrl, split.expense.currency, split.amount);
    }
    for (const split of myOwedSplits) {
      bump(split.expense.paidById, split.expense.paidBy.name, split.expense.paidBy.avatarUrl, split.expense.currency, -split.amount);
    }
    for (const s of settlements) {
      if (s.fromUserId === userId) bump(s.toUserId, s.toUser.name, s.toUser.avatarUrl, s.currency, s.amount);
      else bump(s.fromUserId, s.fromUser.name, s.fromUser.avatarUrl, s.currency, -s.amount);
    }

    // ── Per-group balance (same per-currency rule) ──────────────────────
    const groupMap = new Map<string, Map<string, number>>();
    const bumpGroup = (gId: string, currency: string, amount: number) => {
      const nets = groupMap.get(gId) ?? new Map<string, number>();
      nets.set(currency, (nets.get(currency) ?? 0) + amount);
      groupMap.set(gId, nets);
    };
    for (const split of myPaidSplits) if (split.expense.groupId) bumpGroup(split.expense.groupId, split.expense.currency, split.amount);
    for (const split of myOwedSplits) if (split.expense.groupId) bumpGroup(split.expense.groupId, split.expense.currency, -split.amount);
    for (const s of settlements) {
      if (s.groupId) bumpGroup(s.groupId, s.currency, s.fromUserId === userId ? s.amount : -s.amount);
    }

    /** Largest absolute balance becomes the headline; every non-zero currency is listed in `all`. */
    const summarise = (nets: Map<string, number>) => {
      const all = [...nets.entries()]
        .filter(([, net]) => net !== 0)
        .map(([currency, net]) => ({ currency, net }))
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
      const head = all[0] ?? { currency: [...nets.keys()][0] ?? "USD", net: 0 };
      return { net: head.net, currency: head.currency, all };
    };

    const byPerson = Object.fromEntries(
      [...personMap.entries()].map(([id, p]) => [id, { name: p.name, avatarUrl: p.avatarUrl, ...summarise(p.nets) }])
    );
    const byGroup = Object.fromEntries(
      [...groupMap.entries()].map(([id, nets]) => [id, summarise(nets)])
    );

    const res = ok({
      byPerson,
      byGroup,
    });
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
