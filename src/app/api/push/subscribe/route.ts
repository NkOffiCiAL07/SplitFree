import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";
import { isAllowedPushEndpoint } from "@/lib/push-endpoints";

const MAX_SUBSCRIPTIONS_PER_USER = 10;

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(10).max(512), auth: z.string().min(5).max(512) }),
});

// POST — register this browser/device for push notifications
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { endpoint, keys } = subscribeSchema.parse(await req.json());

    if (!isAllowedPushEndpoint(endpoint)) return err("Unsupported push service", 400);

    const mine = await prisma.pushSubscription.count({ where: { userId: user!.id } });
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (!existing && mine >= MAX_SUBSCRIPTIONS_PER_USER) return err("Too many devices registered", 429);

    // Same browser signing in as a different user moves the subscription to that user
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: user!.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return ok({ subscribed: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}

// DELETE — stop push notifications on this device
export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json());
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user!.id } });
    return ok({ subscribed: false });
  } catch (e) {
    return handleError(e);
  }
}
