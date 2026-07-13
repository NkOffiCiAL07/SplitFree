import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { updateGroupSchema } from "@/lib/validations/group";

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

    const [group, allExpenses, allSettlements] = await Promise.all([
      prisma.group.findUnique({
        where: { id },
        include: {
          members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
          expenses: {
            include: { paidBy: true, splits: { include: { user: true } } },
            orderBy: { date: "desc" },
            take: 20,
          },
          _count: { select: { expenses: true, members: true } },
        },
      }),
      // All expenses for accurate balance calculation
      prisma.expense.findMany({
        where: { groupId: id },
        include: { splits: true },
      }),
      // All settlements in this group involving me
      prisma.settlement.findMany({
        where: {
          groupId: id,
          OR: [{ fromUserId: user!.id }, { toUserId: user!.id }],
        },
      }),
    ]);

    if (!group) return err("Group not found", 404);

    // Compute per-member net balance from my perspective
    // positive = they owe me, negative = I owe them
    const balances: Record<string, number> = {};

    for (const expense of allExpenses) {
      for (const split of expense.splits) {
        if (split.userId === user!.id && expense.paidById !== user!.id) {
          // I owe the payer my share
          balances[expense.paidById] = (balances[expense.paidById] ?? 0) - split.amount;
        } else if (expense.paidById === user!.id && split.userId !== user!.id) {
          // The split person owes me their share
          balances[split.userId] = (balances[split.userId] ?? 0) + split.amount;
        }
      }
    }

    // Adjust for settlements
    for (const s of allSettlements) {
      if (s.fromUserId === user!.id) {
        // I paid someone — reduces what they owe me (or reduces what I owe them)
        balances[s.toUserId] = (balances[s.toUserId] ?? 0) + s.amount;
      } else {
        // Someone paid me — reduces what I owe them
        balances[s.fromUserId] = (balances[s.fromUserId] ?? 0) - s.amount;
      }
    }

    // Attach balance to each member
    const memberBalances = group.members
      .filter((m) => m.userId !== user!.id)
      .map((m) => ({
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        balance: balances[m.userId] ?? 0, // cents
      }))
      .filter((m) => m.balance !== 0);

    return ok({ ...group, memberBalances });
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
