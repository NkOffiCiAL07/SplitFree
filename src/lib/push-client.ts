/** Browser-side helpers for Web Push (no server imports — safe to use in components). */

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** VAPID public keys are base64url; pushManager.subscribe wants raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

/** Gives up (resolves with `fallback`) when a browser API never answers, so a settings page can never wait on it forever. */
function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([work, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Whether this browser currently has an active push subscription. Only LOOKS at the existing service-worker
 * registration (it never registers one just to ask), and stops waiting after 3 seconds.
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await withTimeout(navigator.serviceWorker.getRegistration(), 3000, undefined);
    if (!reg) return null; // nothing registered yet, so nothing subscribed
    return await withTimeout(reg.pushManager.getSubscription(), 3000, null);
  } catch {
    return null;
  }
}

export type PushResult = { ok: true } | { ok: false; reason: "unsupported" | "denied" | "not-configured" | "failed" };

/** Asks permission, subscribes, and registers the subscription with the server. */
export async function enablePush(publicKey: string | undefined): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!publicKey) return { ok: false, reason: "not-configured" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function disablePush(): Promise<boolean> {
  const sub = await getPushSubscription();
  if (!sub) return true;
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    return await sub.unsubscribe();
  } catch {
    return false;
  }
}
