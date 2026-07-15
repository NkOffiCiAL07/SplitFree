import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { randomBytes } from "crypto";

// GET — return existing token (or generate one)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user!.id } },
    });
    if (!member) return err("Not a member of this group", 403);

    let group = await prisma.group.findUnique({ where: { id }, select: { id: true, inviteToken: true, inviteTokenExpiresAt: true } });
    if (!group) return err("Group not found", 404);

    const expired = group.inviteTokenExpiresAt && group.inviteTokenExpiresAt < new Date();
    if (!group.inviteToken || expired) {
      const token = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      group = await prisma.group.update({
        where: { id },
        data: { inviteToken: token, inviteTokenExpiresAt: expiresAt },
        select: { id: true, inviteToken: true, inviteTokenExpiresAt: true },
      });
    }

    return ok({ token: group.inviteToken, expiresAt: group.inviteTokenExpiresAt });
  } catch (e) {
    return handleError(e);
  }
}

// DELETE — revoke token
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user!.id } },
    });
    if (!member || member.role !== "ADMIN") return err("Only admins can revoke invite links", 403);

    await prisma.group.update({ where: { id }, data: { inviteToken: null, inviteTokenExpiresAt: null } });
    return ok({ revoked: true });
  } catch (e) {
    return handleError(e);
  }
}
