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
 * The same submission must always carry the same client id until it is confirmed: if a request errored and the user
 * taps Save again (or double-taps), the server — which may already have recorded the first attempt — recognises the id
 * and returns that record instead of creating a second one. Keyed by what was submitted; forgotten once settled.
 */
const IN_FLIGHT_TTL_MS = 10 * 60 * 1000;
const attempts = new Map<string, { id: string; at: number }>();

function attemptId(key: string): string {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.at > IN_FLIGHT_TTL_MS) attempts.delete(k);
  const known = attempts.get(key);
  if (known) return known.id;
  const id = newClientId();
  attempts.set(key, { id, at: now });
  return id;
}

/** Test hook. */
export function resetAttempts() {
  attempts.clear();
}

/**
 * POST that survives being offline: with a connection it behaves like a normal call; without one (or if the
 * connection drops mid-request) the write is queued with its client id and replayed later — the server recognises the
 * id, so a request that actually got through before the drop is never applied twice.
 */
export async function postOrQueue<T>(
  url: string,
  body: Record<string, unknown>,
  meta: { kind: OutboxKind; label: string; amount: number; currency: string }
): Promise<T | QueuedResult> {
  const key = `${url}|${JSON.stringify(body)}`;
  const id = attemptId(key);
  try {
    const result = await apiFetch<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, clientId: id }),
    });
    attempts.delete(key); // confirmed saved: the next identical submission is a genuinely new one
    return result;
  } catch (e) {
    if (!isNetworkError(e)) throw e; // a real server answer: keep the id so a manual retry stays idempotent
    const item = enqueue({ id, url, body, ...meta });
    if (!item) throw e; // can't store it safely (signed out / queue full / device storage refused): don't pretend
    attempts.delete(key); // it now lives in the outbox under this id
    return { queued: true, id };
  }
}
