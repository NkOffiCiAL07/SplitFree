import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit, clientIp, tooManyRequests } from "@/lib/api-helpers";
import { createGroupSchema } from "@/lib/validations/group";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // Active groups by default; ?archived=true lists the archived ones instead
    const archived = new URL(req.url).searchParams.get("archived") === "true";

    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: user!.id } }, archivedAt: archived ? { not: null } : null },
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
  if (rateLimit(`ip:${clientIp(req)}`, 300)) return err("Too many requests", 429); // flood guard (addresses are shared)

  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    { const limited = tooManyRequests(user!.id, "group-create", 20); if (limited) return limited; }

    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);

    const body = await req.json();
    const data = createGroupSchema.parse(body);

    // Resolve memberEmails → userIds (skip emails that don't exist)
    const extraMembers: { userId: string; role: "MEMBER" }[] = [];
    if (data.memberEmails?.length) {
      const users = await prisma.user.findMany({
        where: { email: { in: data.memberEmails }, id: { not: user!.id } },
        select: { id: true },
      });
      extraMembers.push(...users.map((u) => ({ userId: u.id, role: "MEMBER" as const })));
    }

    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        currency: data.currency,
        createdById: user!.id,
        members: {
          create: [{ userId: user!.id, role: "ADMIN" }, ...extraMembers],
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
