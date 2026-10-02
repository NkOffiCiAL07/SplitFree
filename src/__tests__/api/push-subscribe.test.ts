import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { POST, DELETE } from "@/app/api/push/subscribe/route";
import { PATCH as PATCH_PROFILE } from "@/app/api/profile/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const req = (method: string, body: unknown) => new NextRequest("http://x/api/push/subscribe", { method, body: JSON.stringify(body) });
const sub = (over: Record<string, unknown> = {}) => ({
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", auth: "tBHItJI5svbpez7KI4CCXg" }, ...over,
});

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.pushSubscription.count.mockResolvedValue(0);
  p.pushSubscription.findUnique.mockResolvedValue(null);
  p.pushSubscription.upsert.mockResolvedValue({});
});

describe("POST /api/push/subscribe", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await POST(req("POST", sub()))).status).toBe(401);
  });

  it("stores the subscription for the signed-in user", async () => {
    const res = await POST(req("POST", sub()));
    expect(res.status).toBe(201);
    const args = p.pushSubscription.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/abc123" });
    expect(args.create).toMatchObject({ userId: ME, p256dh: expect.any(String), auth: expect.any(String) });
  });

  it("moves an existing endpoint to the current user (same browser, different account)", async () => {
    p.pushSubscription.findUnique.mockResolvedValue({ userId: "someone-else" });
    await POST(req("POST", sub()));
    expect(p.pushSubscription.upsert.mock.calls[0][0].update.userId).toBe(ME);
  });

  it("rejects endpoints that aren't real push services (SSRF guard)", async () => {
    const res = await POST(req("POST", sub({ endpoint: "https://169.254.169.254/latest/meta-data" })));
    expect(res.status).toBe(400);
    expect(p.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("validates the payload", async () => {
    expect((await POST(req("POST", { endpoint: "https://fcm.googleapis.com/x" }))).status).toBe(422);
    expect((await POST(req("POST", sub({ keys: { p256dh: "x", auth: "y" } })))).status).toBe(422);
  });

  it("caps the number of devices per user but still lets a known device refresh", async () => {
    p.pushSubscription.count.mockResolvedValue(10);
    expect((await POST(req("POST", sub()))).status).toBe(429);
    p.pushSubscription.findUnique.mockResolvedValue({ userId: ME }); // already registered
    expect((await POST(req("POST", sub()))).status).toBe(201);
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("removes only the caller's own subscription", async () => {
    p.pushSubscription.deleteMany.mockResolvedValue({});
    expect((await DELETE(req("DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/abc123" }))).status).toBe(200);
    expect(p.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", userId: ME } });
  });
});

describe("PATCH /api/profile — emailNotifications", () => {
  it("saves the email preference", async () => {
    p.user.update.mockResolvedValue({ id: ME, emailNotifications: false });
    const res = await PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: JSON.stringify({ emailNotifications: false }) }));
    expect(res.status).toBe(200);
    expect(p.user.update.mock.calls[0][0].data).toEqual({ emailNotifications: false });
  });
  it("rejects non-boolean values", async () => {
    const res = await PATCH_PROFILE(new Request("http://x", { method: "PATCH", body: JSON.stringify({ emailNotifications: "no" }) }));
    expect(res.status).toBe(422);
  });
});
