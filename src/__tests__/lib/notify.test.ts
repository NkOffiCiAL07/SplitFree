import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock, resetPrisma } from "../api/helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../api/helpers")).prismaMock }));
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a), setVapidDetails: (...a: unknown[]) => setVapidDetails(...a) } }));

import { createNotifications, fanOut, notificationUrl, type NotificationInput } from "@/lib/notify";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const item = (over: Partial<NotificationInput> = {}): NotificationInput => ({
  userId: "u1", type: "EXPENSE_ADDED", title: "Asha added an expense", body: "Dinner — your share: ₹100.00", data: { groupId: "g1" }, ...over,
});

function enablePush() {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
}

beforeEach(() => {
  resetPrisma();
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  p.notification.createMany.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("notificationUrl", () => {
  it("routes by type, falling back to the group or the activity feed", () => {
    expect(notificationUrl({ type: "PAYMENT_REMINDER" })).toBe("/settle");
    expect(notificationUrl({ type: "SETTLEMENT_ADDED" })).toBe("/settle");
    expect(notificationUrl({ type: "FRIEND_ADDED" })).toBe("/friends");
    expect(notificationUrl({ type: "EXPENSE_ADDED", data: { groupId: "g9" } })).toBe("/groups/g9");
    expect(notificationUrl({ type: "EXPENSE_ADDED" })).toBe("/activity");
  });
});

describe("createNotifications", () => {
  it("writes the in-app rows and does nothing else when push and email are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    await createNotifications([item(), item({ userId: "u2" })]);
    expect(p.notification.createMany).toHaveBeenCalledOnce();
    expect(p.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(p.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("is a no-op for an empty list", async () => {
    await createNotifications([]);
    expect(p.notification.createMany).not.toHaveBeenCalled();
  });

  it("writes through a transaction client when given one", async () => {
    const tx = { notification: { createMany: vi.fn().mockResolvedValue({}) } };
    await createNotifications([item()], tx as never);
    expect(tx.notification.createMany).toHaveBeenCalledOnce();
    expect(p.notification.createMany).not.toHaveBeenCalled();
  });

  it("sends push after creating the rows when VAPID keys exist", async () => {
    enablePush();
    p.pushSubscription.findMany.mockResolvedValue([{ userId: "u1", endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a" }]);
    await createNotifications([item()]);
    expect(sendNotification).toHaveBeenCalledOnce();
  });
});

describe("fanOut — web push", () => {
  beforeEach(enablePush);

  it("sends each user's notification to every device they registered, with the right URL and tag", async () => {
    p.pushSubscription.findMany.mockResolvedValue([
      { userId: "u1", endpoint: "https://fcm.googleapis.com/a", p256dh: "k1", auth: "a1" },
      { userId: "u1", endpoint: "https://updates.push.services.mozilla.com/b", p256dh: "k2", auth: "a2" },
      { userId: "u2", endpoint: "https://fcm.googleapis.com/c", p256dh: "k3", auth: "a3" },
    ]);
    await fanOut([item({ userId: "u1" }), item({ userId: "u2", type: "PAYMENT_REMINDER", title: "Reminder", body: "Pay up" })]);
    expect(sendNotification).toHaveBeenCalledTimes(3); // u1: 2 devices × 1 item, u2: 1 device × 1 item
    const payloads = sendNotification.mock.calls.map((c) => JSON.parse(c[1] as string));
    expect(payloads.filter((x) => x.url === "/groups/g1")).toHaveLength(2);
    expect(payloads.find((x) => x.tag === "PAYMENT_REMINDER")).toMatchObject({ url: "/settle", title: "Reminder" });
    expect(setVapidDetails).toHaveBeenCalledWith(expect.stringMatching(/^https:/), "pub", "priv");
  });

  it("forgets subscriptions the browser reports as gone (404/410) and keeps the rest", async () => {
    p.pushSubscription.findMany.mockResolvedValue([
      { userId: "u1", endpoint: "https://fcm.googleapis.com/dead", p256dh: "k", auth: "a" },
      { userId: "u1", endpoint: "https://fcm.googleapis.com/ok", p256dh: "k", auth: "a" },
      { userId: "u1", endpoint: "https://fcm.googleapis.com/flaky", p256dh: "k", auth: "a" },
    ]);
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/dead")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("/flaky")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    p.pushSubscription.deleteMany.mockResolvedValue({});
    await fanOut([item()]);
    expect(p.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: ["https://fcm.googleapis.com/dead"] } } });
  });

  it("never throws, even if push or the database fails", async () => {
    p.pushSubscription.findMany.mockRejectedValue(new Error("db down"));
    await expect(fanOut([item()])).resolves.toBeUndefined();
  });
});

describe("fanOut — email", () => {
  beforeEach(() => vi.stubEnv("RESEND_API_KEY", "re_test"));

  it("emails only the important types, only to users who have email notifications on", async () => {
    p.user.findMany.mockResolvedValue([{ id: "u1", email: "a@x.com" }]);
    await fanOut([
      item({ userId: "u1", type: "PAYMENT_REMINDER", title: "Reminder", body: "Pay" }),
      item({ userId: "u1", type: "EXPENSE_ADDED" }), // too noisy to email
    ]);
    expect(p.user.findMany.mock.calls[0][0].where).toMatchObject({ emailNotifications: true });
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(["a@x.com"]);
    expect(body.subject).toBe("Reminder");
  });

  it("skips users who opted out (they are filtered out by the query)", async () => {
    p.user.findMany.mockResolvedValue([]);
    await fanOut([item({ type: "SETTLEMENT_ADDED" })]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("doesn't query anyone when no notification is email-worthy", async () => {
    await fanOut([item({ type: "EXPENSE_UPDATED" })]);
    expect(p.user.findMany).not.toHaveBeenCalled();
  });
});
