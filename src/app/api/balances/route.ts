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

    // ── Per-person balance ──────────────────────────────────────────────
    const personMap = new Map<string, { name: string; avatarUrl: string | null; net: number; currency: string }>();

    for (const split of myPaidSplits) {
      const cur = personMap.get(split.userId) ?? { name: split.user.name, avatarUrl: split.user.avatarUrl, net: 0, currency: split.expense.currency };
      cur.net += split.amount;
      personMap.set(split.userId, cur);
    }
    for (const split of myOwedSplits) {
      const uid = split.expense.paidById;
      const cur = personMap.get(uid) ?? { name: split.expense.paidBy.name, avatarUrl: split.expense.paidBy.avatarUrl, net: 0, currency: split.expense.currency };
      cur.net -= split.amount;
      personMap.set(uid, cur);
    }
    for (const s of settlements) {
      if (s.fromUserId === userId) {
        const cur = personMap.get(s.toUserId) ?? { name: s.toUser.name, avatarUrl: s.toUser.avatarUrl, net: 0, currency: s.currency };
        cur.net += s.amount;
        personMap.set(s.toUserId, cur);
      } else {
        const cur = personMap.get(s.fromUserId) ?? { name: s.fromUser.name, avatarUrl: s.fromUser.avatarUrl, net: 0, currency: s.currency };
        cur.net -= s.amount;
        personMap.set(s.fromUserId, cur);
      }
    }

    // ── Per-group balance ───────────────────────────────────────────────
    const groupMap = new Map<string, { net: number; currency: string }>();

    for (const split of myPaidSplits) {
      const gId = split.expense.groupId;
      if (!gId) continue;
      const cur = groupMap.get(gId) ?? { net: 0, currency: split.expense.currency };
      cur.net += split.amount;
      groupMap.set(gId, cur);
    }
    for (const split of myOwedSplits) {
      const gId = split.expense.groupId;
      if (!gId) continue;
      const cur = groupMap.get(gId) ?? { net: 0, currency: split.expense.currency };
      cur.net -= split.amount;
      groupMap.set(gId, cur);
    }
    for (const s of settlements) {
      if (!s.groupId) continue;
      const cur = groupMap.get(s.groupId) ?? { net: 0, currency: s.currency };
      if (s.fromUserId === userId) cur.net += s.amount;
      else cur.net -= s.amount;
      groupMap.set(s.groupId, cur);
    }

    const res = ok({
      byPerson: Object.fromEntries(personMap),
      byGroup: Object.fromEntries(groupMap),
    });
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
