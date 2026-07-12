import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { addMemberSchema } from "@/lib/validations/group";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const adminMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!adminMember || adminMember.role !== "ADMIN") return err("Admin required", 403);

    const body = await req.json();
    const { email } = addMemberSchema.parse(body);

    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee) return err("User not found. They must sign up first.", 404);

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: invitee.id } },
    });
    if (existing) return err("User is already a member", 409);

    const member = await prisma.groupMember.create({
      data: { groupId, userId: invitee.id, role: "MEMBER" },
      include: { user: true },
    });

    // Notify the invitee
    await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: "GROUP_JOINED",
        title: "You were added to a group",
        body: `You've been added to the group by ${user!.email}`,
        data: { groupId },
      },
    });

    await prisma.activity.create({
      data: { type: "MEMBER_ADDED", userId: user!.id, groupId, metadata: { memberId: invitee.id } },
    });

    return ok(member, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const { userId } = await req.json();

    const adminMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!adminMember || (adminMember.role !== "ADMIN" && userId !== user!.id)) {
      return err("Admin required to remove others", 403);
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    await prisma.activity.create({
      data: { type: "MEMBER_REMOVED", userId: user!.id, groupId, metadata: { removedUserId: userId } },
    });

    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
