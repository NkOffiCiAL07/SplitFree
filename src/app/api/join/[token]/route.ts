import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit, clientIp, tooManyRequests } from "@/lib/api-helpers";

async function findGroup(token: string) {
  return prisma.group.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiresAt: { gt: new Date() },
      archivedAt: null, // archived groups can't be joined
    },
    select: {
      id: true, name: true, description: true, category: true, currency: true,
      _count: { select: { members: true, expenses: true } },
    },
  });
}

// GET — preview group info (public, no auth needed for preview)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Nobody is signed in here, so limit by address — generously, since a whole venue scanning one QR code shares an address
  if (rateLimit(`join-preview:${clientIp(req)}`, 300)) return err("Too many requests", 429);
  try {
    const { token } = await params;
    const group = await findGroup(token);
    if (!group) return err("Invite link is invalid or has expired", 404);
    const res = ok(group);
    // A burst of people scanning the same QR code should cost one database read, not hundreds
    res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}

// POST — join the group
export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    { const limited = tooManyRequests(user!.id, "join", 30); if (limited) return limited; }
    const { token } = await params;

    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);

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
