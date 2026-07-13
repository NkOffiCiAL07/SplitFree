import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit } from "@/lib/api-helpers";
import { createGroupSchema } from "@/lib/validations/group";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: user!.id } } },
      include: {
        members: {
          take: 5,
          select: { userId: true, role: true, user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { expenses: true, members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const res = ok(groups);
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimit(ip, 20)) return err("Too many requests", 429);

  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();
    const data = createGroupSchema.parse(body);

    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        currency: data.currency,
        createdById: user!.id,
        members: {
          create: { userId: user!.id, role: "ADMIN" },
        },
      },
      include: {
        members: { include: { user: true } },
        _count: { select: { expenses: true, members: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "GROUP_CREATED",
        userId: user!.id,
        groupId: group.id,
        metadata: { groupName: group.name },
      },
    });

    return ok(group, 201);
  } catch (e) {
    return handleError(e);
  }
}
