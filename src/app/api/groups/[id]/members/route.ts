import { createNotifications } from "@/lib/notify";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, rateLimit, isGroupArchived, ARCHIVED_MESSAGE } from "@/lib/api-helpers";
import { loadGroupLedger } from "@/lib/ledger-db";
import { userNet } from "@/lib/ledger";
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
    if (await isGroupArchived(groupId)) return err(ARCHIVED_MESSAGE, 409);

    const body = await req.json();
    const { email } = addMemberSchema.parse(body);

    const invitee = await prisma.user.findUnique({ where: { email } });

    if (!invitee) {
      // Each invite sends a real email — throttle per caller (best-effort, per instance)
      if (rateLimit(`invite:${user!.id}`, 10, 60 * 60_000)) return err("Too many invites, try again later", 429);
      // Store pending invite
      await prisma.groupInvite.upsert({
        where: { groupId_email: { groupId, email } },
        update: { invitedBy: user!.id, createdAt: new Date() },
        create: { groupId, email, invitedBy: user!.id },
      });

      // Send invite email via Supabase
      const { createAdminClient } = await import("@/lib/supabase/server");
      const admin = await createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.splitr.pro";
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
    await createNotifications([{
        userId: invitee.id,
        type: "GROUP_JOINED",
        title: `You were added to "${group?.name}"`,
        body: `${user!.email} added you to the group`,
        data: { groupId },
      }]);

    // Notify all existing members that someone new joined
    const existingMemberIds = (await prisma.groupMember.findMany({
      where: { groupId, userId: { notIn: [invitee.id, user!.id] } },
      select: { userId: true },
    })).map((m) => m.userId);

    if (existingMemberIds.length > 0) {
      await createNotifications(existingMemberIds.map((uid) => ({
          userId: uid,
          type: "FRIEND_ADDED" as const,
          title: `${invitee.name} joined "${group?.name}"`,
          body: `${user!.email} added ${invitee.name} to the group`,
          data: { groupId, memberId: invitee.id },
        })));
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
    if (typeof userId !== "string" || !["ADMIN", "MEMBER"].includes(role)) return err("Invalid request", 400);
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
    if (typeof userId !== "string" || !userId) return err("userId is required", 400);

    const adminMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user!.id } },
    });
    if (!adminMember || (adminMember.role !== "ADMIN" && userId !== user!.id)) {
      return err("Admin required to remove others", 403);
    }

    // Block leave/remove if the target user has an unsettled balance in this group.
    // Uses the shared ledger, so multi-payer expenses and every currency are accounted for.
    const { edges } = await loadGroupLedger(groupId);
    const nets = userNet(edges, userId);
    // positive = owed money, negative = owes money; a mix of both is reported as "owes" first
    const owes = [...nets.values()].some((v) => v < 0);
    const net = owes ? -1 : [...nets.values()].some((v) => v > 0) ? 1 : 0;

    if (net !== 0) {
      const isSelf = userId === user!.id;
      if (net > 0) {
        return err(
          isSelf
            ? "You are owed money in this group. Settle up before leaving."
            : "This member is owed money in the group. They must settle up first.",
          400
        );
      } else {
        return err(
          isSelf
            ? "You owe money in this group. Settle up before leaving."
            : "This member owes money in the group. They must settle up first.",
          400
        );
      }
    }

    // Never leave a group with members but no admin
    const target = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (target?.role === "ADMIN") {
      const others = await prisma.groupMember.findMany({
        where: { groupId, userId: { not: userId } },
        select: { role: true },
      });
      if (others.length > 0 && !others.some((m) => m.role === "ADMIN")) {
        return err("Promote another member to admin before removing the last admin.", 400);
      }
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
