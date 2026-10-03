import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { updateGroupSchema } from "@/lib/validations/group";
import { computeGroupStats } from "@/lib/group-stats";
import { loadGroupLedger } from "@/lib/ledger-db";
import { pairNets } from "@/lib/ledger";
import { homeCurrencyOf, loadConverter } from "@/lib/convert";

async function assertMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const member = await assertMember(id, user!.id);
    if (!member) return err("Not a member of this group", 403);

    const [group, groupLedger] = await Promise.all([
      prisma.group.findUnique({
        where: { id },
        include: {
          members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
          expenses: {
            include: { paidBy: true, splits: { include: { user: true } }, payers: { include: { user: true } } },
            orderBy: { date: "desc" },
            take: 20,
          },
          _count: { select: { expenses: true, members: true } },
        },
      }),
      // Every expense and settlement in the group, for accurate balances
      loadGroupLedger(id),
    ]);
    if (!group) return err("Group not found", 404);

    // Per-member balance from my perspective (positive = they owe me), per currency.
    // `balance` is in the group's currency; anything else is listed in `others`.
    const nets = pairNets(groupLedger.edges, user!.id);
    const memberBalances = group.members
      .filter((m) => m.userId !== user!.id)
      .map((m) => {
        const byCurrency = nets.get(m.userId) ?? new Map<string, number>();
        return {
          userId: m.userId,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          balance: byCurrency.get(group.currency) ?? 0, // cents
          others: [...byCurrency.entries()]
            .filter(([cur]) => cur !== group.currency)
            .map(([currency, net]) => ({ currency, net })),
        };
      })
      .filter((m) => m.balance !== 0 || m.others.length > 0);

    // Spending is summarised in the viewer's home currency (other currencies converted, flagged approximate)
    const home = await homeCurrencyOf(user!.id);
    const conv = await loadConverter(home, groupLedger.expenses.some((e) => e.currency !== home));
    const stats = computeGroupStats(groupLedger.expenses.map((e) => ({ ...e, category: e.category ?? "OTHER" })), user!.id, conv);

    return ok({ ...group, memberBalances, stats });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const member = await assertMember(id, user!.id);
    if (!member || member.role !== "ADMIN") return err("Admin required", 403);

    const body = await req.json();
    const data = updateGroupSchema.parse({ ...body, id });

    const group = await prisma.group.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        currency: data.currency,
      },
      include: { members: { include: { user: true } }, _count: { select: { expenses: true, members: true } } },
    });

    return ok(group);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return err("Group not found", 404);
    if (group.createdById !== user!.id) return err("Only creator can delete group", 403);

    await prisma.group.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
