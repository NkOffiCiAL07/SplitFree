import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const notifications = await prisma.notification.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return ok(notifications);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { ids, markAll } = body as { ids?: string[]; markAll?: boolean };

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: user!.id },
        data: { isRead: true },
      });
    } else if (ids?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: user!.id },
        data: { isRead: true },
      });
    }

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
