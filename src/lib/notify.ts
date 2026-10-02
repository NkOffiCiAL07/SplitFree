import webpush from "web-push";
import { after } from "next/server";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailConfigured } from "@/lib/email";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonObject;
}

/** Only these are worth an email; the rest (expense added/updated, comments…) would be noise. */
const EMAIL_TYPES: NotificationType[] = ["PAYMENT_REMINDER", "SETTLEMENT_ADDED", "GROUP_JOINED", "FRIEND_ADDED"];

const pushConfigured = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Where tapping the notification should take the user. */
export function notificationUrl(n: Pick<NotificationInput, "type" | "data">): string {
  const groupId = (n.data as { groupId?: string } | undefined)?.groupId;
  switch (n.type) {
    case "PAYMENT_REMINDER":
    case "SETTLEMENT_ADDED":
      return "/settle";
    case "FRIEND_ADDED":
      return "/friends";
    default:
      return groupId ? `/groups/${groupId}` : "/activity";
  }
}

async function sendPush(items: NotificationInput[]) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://splitfree-xi.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(items.map((i) => i.userId))] } },
  });
  const dead: string[] = [];
  await Promise.all(
    subs.flatMap((sub) =>
      items
        .filter((i) => i.userId === sub.userId)
        .map(async (item) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: item.title, body: item.body, url: notificationUrl(item), tag: item.type }),
              { TTL: 60 * 60 * 24 }
            );
          } catch (e) {
            // 404/410 = the browser unsubscribed; forget the endpoint
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) dead.push(sub.endpoint);
          }
        })
    )
  );
  if (dead.length > 0) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
}

async function sendEmails(items: NotificationInput[]) {
  const wanted = items.filter((i) => EMAIL_TYPES.includes(i.type));
  if (wanted.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(wanted.map((i) => i.userId))] }, emailNotifications: true },
    select: { id: true, email: true },
  });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  await Promise.all(
    wanted.map(async (item) => {
      const to = emailOf.get(item.userId);
      if (to) await sendEmail({ to, subject: item.title, text: item.body, ctaPath: notificationUrl(item) });
    })
  );
}

/** Push + email fan-out. Never throws: a failed push must not fail the request that caused it. */
export async function fanOut(items: NotificationInput[]) {
  try {
    const jobs: Promise<unknown>[] = [];
    if (pushConfigured()) jobs.push(sendPush(items));
    if (emailConfigured()) jobs.push(sendEmails(items));
    await Promise.allSettled(jobs);
  } catch {
    /* swallow */
  }
}

/**
 * Create in-app notifications and, in the background, send them as web push (and email for the
 * important types). Pass a transaction client as `db` to create the rows inside a transaction.
 */
export async function createNotifications(
  items: NotificationInput[],
  db: Pick<Prisma.TransactionClient, "notification"> = prisma
) {
  if (items.length === 0) return;
  await db.notification.createMany({
    data: items.map((i) => ({ userId: i.userId, type: i.type, title: i.title, body: i.body, data: i.data })),
    skipDuplicates: true,
  });
  if (!pushConfigured() && !emailConfigured()) return;
  try {
    after(() => fanOut(items)); // runs after the response is sent
  } catch {
    await fanOut(items); // outside a request scope (scripts/tests): just do it inline
  }
}
