import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return ok({ groups: [], expenses: [], friends: [] });

    const [groups, expenses, friends] = await Promise.all([
      prisma.group.findMany({
        where: {
          members: { some: { userId: user!.id } },
          name: { contains: q, mode: "insensitive" },
        },
        take: 5,
        select: { id: true, name: true, category: true },
      }),
      prisma.expense.findMany({
        where: {
          splits: { some: { userId: user!.id } },
          description: { contains: q, mode: "insensitive" },
        },
        take: 5,
        select: { id: true, description: true, amount: true, date: true },
      }),
      prisma.friendship.findMany({
        where: {
          userId: user!.id,
          friend: { name: { contains: q, mode: "insensitive" } },
        },
        take: 5,
        include: { friend: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      }),
    ]);

    return ok({ groups, expenses, friends: friends.map((f) => f.friend) });
  } catch (e) {
    return handleError(e);
  }
}
