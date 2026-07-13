import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { addMemberSchema } from "@/lib/validations/group";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const callerMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!callerMember) return err("Not a member of this group", 403);

    const body = await req.json();
    const { email } = addMemberSchema.parse(body);

    const invitee = await prisma.user.findUnique({ where: { email } });

    if (!invitee) {
      // Store pending invite
      await prisma.groupInvite.upsert({
        where: { groupId_email: { groupId, email } },
        update: { invitedBy: user!.id, createdAt: new Date() },
        create: { groupId, email, invitedBy: user!.id },
      });

      // Send invite email via Supabase
      const { createAdminClient } = await import("@/lib/supabase/server");
      const admin = await createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://splitfree-xi.vercel.app";
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/auth/callback?next=/groups/${groupId}`,
      });

      return ok({ invited: true, email });
    }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: invitee.id } },
    });
    if (existing) return err("User is already a member", 409);

    const member = await prisma.groupMember.create({
      data: { groupId, userId: invitee.id, role: "MEMBER" },
      include: { user: true },
    });

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });

    // Notify the new member
    await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: "GROUP_JOINED",
        title: `You were added to "${group?.name}"`,
        body: `${user!.email} added you to the group`,
        data: { groupId },
      },
    });

    // Notify all existing members that someone new joined
    const existingMemberIds = (await prisma.groupMember.findMany({
      where: { groupId, userId: { notIn: [invitee.id, user!.id] } },
      select: { userId: true },
    })).map((m) => m.userId);

    if (existingMemberIds.length > 0) {
      await prisma.notification.createMany({
        data: existingMemberIds.map((uid) => ({
          userId: uid,
          type: "FRIEND_ADDED" as const,
          title: `${invitee.name} joined "${group?.name}"`,
          body: `${user!.email} added ${invitee.name} to the group`,
          data: { groupId, memberId: invitee.id },
        })),
        skipDuplicates: true,
      });
    }

    await prisma.activity.create({
      data: { type: "MEMBER_ADDED", userId: user!.id, groupId, metadata: { memberId: invitee.id, memberName: invitee.name } },
    });

    return ok(member, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id: groupId } = await params;

    const callerMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!callerMember || callerMember.role !== "ADMIN") return err("Admin required", 403);

    const { userId, role } = await req.json();
    if (!userId || !["ADMIN", "MEMBER"].includes(role)) return err("Invalid request", 400);
    if (userId === user!.id) return err("Cannot change your own role this way", 400);

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role },
      include: { user: true },
    });

    await prisma.activity.create({
      data: {
        type: "MEMBER_ADDED",
        userId: user!.id,
        groupId,
        metadata: { memberId: userId, role },
      },
    });

    return ok(updated);
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
