import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { updateGroupSchema } from "@/lib/validations/group";

async function assertMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return member;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const member = await assertMember(id, user!.id);
    if (!member) return err("Not a member of this group", 403);

    const group = await prisma.group.findUnique({
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
    });

    if (!group) return err("Group not found", 404);
    return ok(group);
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
