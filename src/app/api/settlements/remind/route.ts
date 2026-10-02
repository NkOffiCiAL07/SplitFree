import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, getKnownUserIds } from "@/lib/api-helpers";
import { formatCurrency } from "@/lib/utils";

const remindSchema = z.object({
  debtorId: z.string().uuid(),
  amount: z.number().int().positive(), // cents
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"]).default("USD"),
});

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// POST — nudge someone who owes you. One reminder per person per 24h.
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { debtorId, amount, currency } = remindSchema.parse(await req.json());
    if (debtorId === user!.id) return err("You can't remind yourself", 400);
    if (!(await getKnownUserIds(user!.id)).has(debtorId)) return err("Unknown user", 403);

    const since = new Date(Date.now() - COOLDOWN_MS);
    const recent = await prisma.notification.findMany({
      where: { userId: debtorId, type: "PAYMENT_REMINDER", createdAt: { gte: since } },
      select: { data: true },
    });
    if (recent.some((n) => (n.data as { fromUserId?: string } | null)?.fromUserId === user!.id)) {
      return err("You already sent a reminder in the last 24 hours", 429);
    }

    const sender = await prisma.user.findUnique({ where: { id: user!.id }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: debtorId,
        type: "PAYMENT_REMINDER",
        title: `${sender?.name ?? "A friend"} sent you a reminder`,
        body: `Friendly nudge: you owe ${formatCurrency(amount, currency)}. Open Settle up to pay.`,
        data: { fromUserId: user!.id, amount, currency },
      },
    });

    return ok({ sent: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}
