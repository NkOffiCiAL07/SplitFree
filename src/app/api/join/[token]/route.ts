import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError } from "@/lib/api-helpers";

async function findGroup(token: string) {
  return prisma.group.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true, name: true, description: true, category: true, currency: true,
      _count: { select: { members: true, expenses: true } },
    },
  });
}

// GET — preview group info (public, no auth needed for preview)
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const group = await findGroup(token);
    if (!group) return err("Invite link is invalid or has expired", 404);
    return ok(group);
  } catch (e) {
    return handleError(e);
  }
}

// POST — join the group
export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { token } = await params;

    await ensureUserProfile(user!.id, user!.email!);

    const group = await findGroup(token);
    if (!group) return err("Invite link is invalid or has expired", 404);

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user!.id } },
    });
    if (existing) return ok({ groupId: group.id, alreadyMember: true });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user!.id, role: "MEMBER" },
    });

    await prisma.activity.create({
      data: {
        type: "MEMBER_ADDED",
        userId: user!.id,
        groupId: group.id,
        metadata: { action: "joined via invite link" },
      },
    });

    return ok({ groupId: group.id, alreadyMember: false }, 201);
  } catch (e) {
    return handleError(e);
  }
}
