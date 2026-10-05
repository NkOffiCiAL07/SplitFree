import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError, ensureUserProfile, tooManyRequests, visibleScope } from "@/lib/api-helpers";
import { fromCents } from "@/lib/utils";
import { format } from "date-fns";

/** GET /api/account/export — everything we hold about you, as one JSON file (amounts in normal units). */
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    { const limited = tooManyRequests(user!.id, "data-export", 10, 60 * 60_000); if (limited) return limited; }
    const userId = user!.id;
    await ensureUserProfile(userId, user!.email!, user!.name, user!.phone);

    const scope = await visibleScope(userId);
    const [profile, memberships, expenses, settlements, friendships, comments, budgets] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, currency: true, timezone: true, upiId: true, phone: true, createdAt: true } }),
      prisma.groupMember.findMany({ where: { userId }, select: { role: true, joinedAt: true, group: { select: { id: true, name: true, currency: true, category: true, createdAt: true, archivedAt: true } } } }),
      prisma.expense.findMany({
        where: scope,
        orderBy: { date: "desc" },
        select: {
          id: true, description: true, amount: true, currency: true, category: true, date: true, notes: true, groupId: true, paidById: true, splitType: true,
          splits: { select: { userId: true, amount: true } },
          payers: { select: { userId: true, amount: true } },
        },
      }),
      prisma.settlement.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, fromUserId: true, toUserId: true, amount: true, currency: true, groupId: true, note: true, createdAt: true },
      }),
      prisma.friendship.findMany({ where: { userId }, select: { friendId: true, createdAt: true } }),
      prisma.expenseComment.findMany({ where: { userId }, select: { expenseId: true, text: true, createdAt: true } }),
      prisma.budget.findMany({ where: { userId }, select: { groupId: true, category: true, period: true, amount: true } }),
    ]);

    // Names only (not other people's emails) so the file makes sense without exposing anyone else's details
    const ids = new Set<string>([userId]);
    expenses.forEach((e) => { ids.add(e.paidById); e.splits.forEach((s) => ids.add(s.userId)); e.payers.forEach((p) => ids.add(p.userId)); });
    settlements.forEach((s) => { ids.add(s.fromUserId); ids.add(s.toUserId); });
    friendships.forEach((f) => ids.add(f.friendId));
    const people = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });

    const money = (cents: number) => fromCents(cents);
    const body = {
      exportedAt: new Date().toISOString(),
      note: "Amounts are in each record's own currency, in normal units (e.g. 12.50). People are listed by name only.",
      profile,
      people: Object.fromEntries(people.map((p) => [p.id, p.name])),
      groups: memberships.map((m) => ({ ...m.group, yourRole: m.role, joinedAt: m.joinedAt })),
      expenses: expenses.map((e) => ({
        ...e,
        amount: money(e.amount),
        splits: e.splits.map((s) => ({ userId: s.userId, amount: money(s.amount) })),
        payers: e.payers.map((p) => ({ userId: p.userId, amount: money(p.amount) })),
      })),
      settlements: settlements.map((s) => ({ ...s, amount: money(s.amount) })),
      friends: friendships,
      yourComments: comments,
      budgets: budgets.map((b) => ({ ...b, amount: money(b.amount) })),
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="splitr-pro-my-data-${format(new Date(), "yyyy-MM-dd")}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
