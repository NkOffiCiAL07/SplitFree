import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, getKnownUserIds, visibleScope } from "@/lib/api-helpers";
import { buildEdges, expenseDeltaBetween, pairNets, type CurrencyNet } from "@/lib/ledger";

// GET — shared history with one person: balance per currency, expenses and payments between you
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: friendId } = await params;
    const me = user!.id;

    if (friendId === me) return err("That's you", 400);
    if (!(await getKnownUserIds(me)).has(friendId)) return err("Person not found", 404);

    const scope = await visibleScope(me);
    const [friend, expenses, settlements] = await Promise.all([
      prisma.user.findUnique({ where: { id: friendId }, select: { id: true, name: true, email: true, avatarUrl: true, upiId: true } }),
      // Expenses I can see that also involve the friend (as payer, one of several payers, or in the split)
      prisma.expense.findMany({
        where: {
          AND: [
            scope,
            { OR: [{ paidById: friendId }, { splits: { some: { userId: friendId } } }, { payers: { some: { userId: friendId } } }] },
          ],
        },
        select: {
          id: true, description: true, amount: true, currency: true, category: true, date: true, paidById: true, groupId: true,
          group: { select: { id: true, name: true } },
          splits: { select: { userId: true, amount: true } },
          payers: { select: { userId: true, amount: true } },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: 1000,
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: me, toUserId: friendId }, { fromUserId: friendId, toUserId: me }] },
        select: { id: true, fromUserId: true, toUserId: true, amount: true, currency: true, note: true, createdAt: true, groupId: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1000,
      }),
    ]);
    if (!friend) return err("Person not found", 404);

    // Balances use every row; only the most recent are returned for display.
    const nets = pairNets(buildEdges(expenses, settlements), me).get(friendId) ?? new Map<string, number>();
    const balances: CurrencyNet[] = [...nets.entries()]
      .map(([currency, net]) => ({ currency, net }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    // Only expenses that actually create a debt between the two of you; `delta` > 0 means they owe me
    const shared = expenses
      .map((e) => ({ ...e, delta: expenseDeltaBetween(e, me, friendId) }))
      .filter((e) => e.delta !== 0)
      .slice(0, 50)
      .map((e) => ({
        id: e.id, description: e.description, amount: e.amount, currency: e.currency, category: e.category,
        date: e.date, paidById: e.paidById, group: e.group, delta: e.delta,
        multiplePayers: e.payers.length > 1,
      }));

    const res = ok({ friend, balances, expenses: shared, settlements: settlements.slice(0, 20) });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
