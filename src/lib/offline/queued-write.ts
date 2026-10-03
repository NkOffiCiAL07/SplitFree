import { apiFetch, isNetworkError } from "@/lib/api-client";
import { enqueue, newClientId, type OutboxKind } from "./outbox";

/** What a write returns when it was saved on the device to sync later (instead of reaching the server). */
export interface QueuedResult {
  queued: true;
  id: string;
}

export const isQueued = (r: unknown): r is QueuedResult =>
  !!r && typeof r === "object" && (r as QueuedResult).queued === true;

/**
 * POST that survives being offline: with a connection it behaves like a normal call; without one (or if the
 * connection drops mid-request) the write is queued with a client id and replayed later — the server recognises the
 * id, so a request that actually got through before the drop is never applied twice.
 */
export async function postOrQueue<T>(
  url: string,
  body: Record<string, unknown>,
  meta: { kind: OutboxKind; label: string; amount: number; currency: string }
): Promise<T | QueuedResult> {
  const id = newClientId();
  try {
    return await apiFetch<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, clientId: id }),
    });
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const item = enqueue({ id, url, body, ...meta });
    if (!item) throw e; // not signed in on this device: can't safely queue, show the offline message
    return { queued: true, id };
  }
}
