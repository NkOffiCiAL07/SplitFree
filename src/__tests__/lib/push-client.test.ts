import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enablePush, disablePush, getPushSubscription, isPushSupported, urlBase64ToUint8Array } from "@/lib/push-client";

const sub = { endpoint: "https://fcm.googleapis.com/x", toJSON: () => ({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "k", auth: "a" } }), unsubscribe: vi.fn().mockResolvedValue(true) };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
const sw = { getRegistration: vi.fn(), register: vi.fn() };

function install({ supported = true, permission = "granted" as NotificationPermission } = {}) {
  vi.stubGlobal("PushManager", supported ? class {} : undefined);
  if (!supported) delete (globalThis as { PushManager?: unknown }).PushManager;
  vi.stubGlobal("Notification", { permission, requestPermission: vi.fn().mockResolvedValue(permission) });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: supported ? sw : undefined });
  if (!supported) delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
}

beforeEach(() => {
  vi.clearAllMocks();
  pushManager.getSubscription.mockResolvedValue(null);
  pushManager.subscribe.mockResolvedValue(sub);
  sw.getRegistration.mockResolvedValue({ pushManager });
  sw.register.mockResolvedValue({ pushManager });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => vi.unstubAllGlobals());

describe("isPushSupported", () => {
  it("is true only when service workers, PushManager and Notification all exist", () => {
    install({ supported: true });
    expect(isPushSupported()).toBe(true);
    install({ supported: false });
    expect(isPushSupported()).toBe(false);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("round-trips a real-looking VAPID key length (65 bytes)", () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, i) => i * 3 % 256);
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect([...urlBase64ToUint8Array(b64)]).toEqual([...bytes]);
  });
});

describe("getPushSubscription", () => {
  it("returns the current subscription, or null when unsupported or when the lookup fails", async () => {
    install();
    pushManager.getSubscription.mockResolvedValue(sub);
    expect(await getPushSubscription()).toBe(sub);
    pushManager.getSubscription.mockRejectedValue(new Error("boom"));
    expect(await getPushSubscription()).toBeNull();
    install({ supported: false });
    expect(await getPushSubscription()).toBeNull();
  });

  it("only LOOKS for an existing registration: it never registers a service worker just to ask (nothing registered means nothing subscribed)", async () => {
    install();
    sw.getRegistration.mockResolvedValue(undefined);
    expect(await getPushSubscription()).toBeNull();
    expect(sw.register).not.toHaveBeenCalled();
  });

  it("stops waiting when the browser never answers, so a page can never hang on it", async () => {
    vi.useFakeTimers();
    try {
      install();
      sw.getRegistration.mockReturnValue(new Promise(() => {})); // never resolves
      const pending = getPushSubscription();
      await vi.advanceTimersByTimeAsync(3100);
      expect(await pending).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});

describe("enablePush", () => {
  it("fails clearly when unsupported or when the server has no VAPID key", async () => {
    install({ supported: false });
    expect(await enablePush("key")).toEqual({ ok: false, reason: "unsupported" });
    install();
    expect(await enablePush(undefined)).toEqual({ ok: false, reason: "not-configured" });
  });

  it("stops if the user doesn't grant permission", async () => {
    install({ permission: "denied" });
    expect(await enablePush("AQID")).toEqual({ ok: false, reason: "denied" });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes with the VAPID key and registers the subscription with the server", async () => {
    install();
    expect(await enablePush("AQID")).toEqual({ ok: true });
    const opts = pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect([...(opts.applicationServerKey as Uint8Array)]).toEqual([1, 2, 3]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/push/subscribe");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ endpoint: sub.endpoint, keys: { p256dh: "k", auth: "a" } });
  });

  it("reuses an existing browser subscription instead of creating another", async () => {
    install();
    pushManager.getSubscription.mockResolvedValue(sub);
    await enablePush("AQID");
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("reports failure when the server rejects it or the browser throws", async () => {
    install();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await enablePush("AQID")).toEqual({ ok: false, reason: "failed" });
    pushManager.subscribe.mockRejectedValue(new Error("blocked"));
    expect(await enablePush("AQID")).toEqual({ ok: false, reason: "failed" });
  });
});

describe("disablePush", () => {
  it("tells the server, then unsubscribes the browser", async () => {
    install();
    pushManager.getSubscription.mockResolvedValue(sub);
    expect(await disablePush()).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/push/subscribe");
    expect((init as RequestInit).method).toBe("DELETE");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ endpoint: sub.endpoint });
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("is a no-op success when there's nothing to unsubscribe, and false on errors", async () => {
    install();
    expect(await disablePush()).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    pushManager.getSubscription.mockResolvedValue(sub);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await disablePush()).toBe(false);
  });
});
