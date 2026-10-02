import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/app-config";
import { requireAuth, ensureUserProfile, ok, err, handleError } from "@/lib/api-helpers";
import { z } from "zod";

const addFriendSchema = z.object({ email: z.string().email() });

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const pending = new URL(req.url).searchParams.get("pending") === "true";

    if (pending) {
      // Incoming pending requests (others sent to me)
      const requests = await prisma.friendship.findMany({
        where: { friendId: user!.id, status: "PENDING" },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
      return ok(requests);
    }

    const sent = new URL(req.url).searchParams.get("sent") === "true";
    if (sent) {
      // Outgoing pending requests (I sent to others)
      const requests = await prisma.friendship.findMany({
        where: { userId: user!.id, status: "PENDING" },
        include: { friend: true },
        orderBy: { createdAt: "desc" },
      });
      return ok(requests);
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId: user!.id, status: "ACCEPTED" },
      include: { friend: true },
      orderBy: { createdAt: "desc" },
    });

    // contacts=true: friends plus everyone you share a group with (for pickers)
    if (new URL(req.url).searchParams.get("contacts") === "true") {
      const friendIds = new Set(friendships.map((f) => f.friendId));
      const coMembers = await prisma.groupMember.findMany({
        where: {
          userId: { notIn: [user!.id, ...friendIds] },
          group: { members: { some: { userId: user!.id } } },
        },
        distinct: ["userId"],
        include: { user: true },
      });
      const groupContacts = coMembers.map((m) => ({
        id: `group-${m.userId}`,
        userId: user!.id,
        friendId: m.userId,
        status: "ACCEPTED",
        createdAt: m.joinedAt,
        friend: m.user,
        fromGroup: true,
      }));
      return ok([...friendships, ...groupContacts]);
    }

    return ok(friendships);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();

    // Handle accept/decline actions
    if (body.action === "accept" || body.action === "decline") {
      const { requesterId, action } = body as { requesterId: string; action: "accept" | "decline" };

      // Clear the pending notification regardless of accept/decline
      const pendingNotifs = await prisma.notification.findMany({
        where: { userId: user!.id, type: "FRIEND_ADDED", isRead: false },
        select: { id: true, data: true },
      });
      const notifIds = pendingNotifs
        .filter((n) => (n.data as any)?.userId === requesterId && (n.data as any)?.pending === true)
        .map((n) => n.id);
      if (notifIds.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: notifIds } },
          data: { isRead: true, data: { userId: requesterId, pending: false } },
        });
      }

      if (action === "decline") {
        await prisma.friendship.deleteMany({
          where: { userId: requesterId, friendId: user!.id },
        });
        return ok({ declined: true });
      }

      // Accept: update pending to accepted + create reverse
      await prisma.$transaction([
        prisma.friendship.update({
          where: { userId_friendId: { userId: requesterId, friendId: user!.id } },
          data: { status: "ACCEPTED" },
        }),
        prisma.friendship.upsert({
          where: { userId_friendId: { userId: user!.id, friendId: requesterId } },
          create: { userId: user!.id, friendId: requesterId, status: "ACCEPTED" },
          update: { status: "ACCEPTED" },
        }),
      ]);

      // Notify requester
      await prisma.notification.create({
        data: {
          userId: requesterId,
          type: "FRIEND_ADDED",
          title: "Friend request accepted",
          body: `${user!.email} accepted your friend request`,
          data: { userId: user!.id, accepted: true },
        },
      });

      return ok({ accepted: true });
    }

    // Regular add friend (send request)
    const { email } = addFriendSchema.parse(body);
    if (email === user!.email) return err("You can't add yourself", 400);

    const friend = await prisma.user.findUnique({ where: { email } });
    if (!friend) return err("User not found. They need to sign up first.", 404);

    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: user!.id, friendId: friend.id } },
    });
    if (existing) return err(existing.status === "ACCEPTED" ? "Already friends" : "Request already sent", 409);

    // Create single PENDING request
    const friendship = await prisma.friendship.create({
      data: { userId: user!.id, friendId: friend.id, status: "PENDING" },
      include: { friend: true },
    });

    await prisma.notification.create({
      data: {
        userId: friend.id,
        type: "FRIEND_ADDED",
        title: "New friend request",
        body: `${user!.email} wants to connect with you on ${APP_NAME}`,
        data: { userId: user!.id, email: user!.email, pending: true },
      },
    });

    return ok(friendship, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { friendId } = await req.json();

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: user!.id, friendId },
          { userId: friendId, friendId: user!.id },
        ],
      },
    });

    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
