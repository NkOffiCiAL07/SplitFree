import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError } from "@/lib/api-helpers";
import { z } from "zod";

const addFriendSchema = z.object({ email: z.string().email() });

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const friendships = await prisma.friendship.findMany({
      where: { userId: user!.id },
      include: { friend: true },
      orderBy: { createdAt: "desc" },
    });

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
    const { email } = addFriendSchema.parse(body);

    if (email === user!.email) return err("You can't add yourself", 400);

    const friend = await prisma.user.findUnique({ where: { email } });
    if (!friend) return err("User not found. They need to sign up first.", 404);

    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: user!.id, friendId: friend.id } },
    });
    if (existing) return err("Already friends", 409);

    // Create bidirectional friendship
    const [friendship] = await prisma.$transaction([
      prisma.friendship.create({
        data: { userId: user!.id, friendId: friend.id },
        include: { friend: true },
      }),
      prisma.friendship.create({
        data: { userId: friend.id, friendId: user!.id },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: friend.id,
        type: "FRIEND_ADDED",
        title: "New friend connection",
        body: `${user!.email} added you as a friend on SplitFree`,
        data: { userId: user!.id },
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
