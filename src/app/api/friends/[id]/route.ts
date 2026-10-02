import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, getKnownUserIds } from "@/lib/api-helpers";
import { computePairBalances } from "@/lib/pair-balance";

// GET — shared history with one person: balance per currency, expenses and payments between you
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: friendId } = await params;
    const me = user!.id;

    if (friendId === me) return err("That's you", 400);
    if (!(await getKnownUserIds(me)).has(friendId)) return err("Person not found", 404);

    const [friend, expenses, settlements] = await Promise.all([
      prisma.user.findUnique({ where: { id: friendId }, select: { id: true, name: true, email: true, avatarUrl: true } }),
      // Every expense where one of you paid and the other is in the split
      prisma.expense.findMany({
        where: {
          OR: [
            { paidById: me, splits: { some: { userId: friendId } } },
            { paidById: friendId, splits: { some: { userId: me } } },
          ],
        },
        select: {
          id: true, description: true, amount: true, currency: true, category: true, date: true, paidById: true,
          group: { select: { id: true, name: true } },
          splits: { where: { userId: { in: [me, friendId] } }, select: { userId: true, amount: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: 1000,
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: me, toUserId: friendId }, { fromUserId: friendId, toUserId: me }] },
        select: { id: true, fromUserId: true, toUserId: true, amount: true, currency: true, note: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1000,
      }),
    ]);
    if (!friend) return err("Person not found", 404);

    // Balances use every row; only the most recent are returned for display
    const balances = computePairBalances(me, friendId, expenses, settlements);

    const res = ok({ friend, balances, expenses: expenses.slice(0, 50), settlements: settlements.slice(0, 20) });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
