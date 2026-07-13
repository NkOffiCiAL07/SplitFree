import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, handleError } from "@/lib/api-helpers";

const ACTION_LABELS: Record<string, string> = {
  EXPENSE_CREATED: "You added an expense",
  EXPENSE_UPDATED: "You updated an expense",
  EXPENSE_DELETED: "You deleted an expense",
  SETTLEMENT_CREATED: "You recorded a payment",
  GROUP_CREATED: "You created a group",
  MEMBER_ADDED: "You added a member",
  MEMBER_REMOVED: "You removed a member",
};

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);

    const [activities, notifications] = await Promise.all([
      prisma.activity.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          metadata: true,
          createdAt: true,
          group: { select: { id: true, name: true } },
          expense: { select: { id: true, description: true, amount: true, currency: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isRead: true,
          createdAt: true,
          data: true,
        },
      }),
    ]);

    // Merge into a unified feed sorted by date
    const feed = [
      ...activities.map((a) => ({
        id: `act_${a.id}`,
        source: "activity" as const,
        type: a.type,
        title: ACTION_LABELS[a.type] ?? a.type,
        body: [
          a.expense?.description,
          a.group?.name,
          (a.metadata as any)?.groupName,
        ]
          .filter(Boolean)
          .join(" · "),
        isRead: true,
        createdAt: a.createdAt,
        data: a.metadata,
      })),
      ...notifications.map((n) => ({
        id: `notif_${n.id}`,
        source: "notification" as const,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt,
        data: n.data,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const res = ok(feed.slice(0, limit));
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
