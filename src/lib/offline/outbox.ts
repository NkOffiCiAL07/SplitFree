/**
 * Offline outbox: writes made without a connection are queued here (localStorage — small, synchronous, survives
 * reloads) and replayed in order when the connection returns.
 *
 * Money rules this module upholds:
 *  - a queued write is NEVER deleted unless the server confirmed it saved it (or the user discards it);
 *  - every request carries a client-generated id the server treats idempotently, so replays can't duplicate;
 *  - a reply only counts as "saved" if it is a real API response (a captive-portal page returning 200 doesn't);
 *  - writes the server permanently rejects stay visible as "failed" so the user can retry or discard them.
 */
import { isNetworkError } from "@/lib/api-client";

export type OutboxKind = "expense" | "settlement";

export interface OutboxItem {
  id: string; // = the clientId sent to the server
  userId: string;
  kind: OutboxKind;
  url: string;
  body: Record<string, unknown>;
  /** What to show while it waits, e.g. "Dinner" */
  label: string;
  /** Amount in major units, for the "waiting to sync" list */
  amount: number;
  currency: string;
  createdAt: number;
  /** "failed" = the server refused it for good; shown to the user, never auto-retried or deleted */
  status?: "pending" | "failed";
  error?: string;
}

const KEY = "splitfree-outbox-v1";
export const MAX_QUEUED = 200;

const listeners = new Set<() => void>();
let currentUser: string | null = null;
let snapshot: OutboxItem[] = [];
let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  synced: OutboxItem[];
  /** Newly refused by the server (kept in the queue, marked failed) */
  failed: { item: OutboxItem; message: string }[];
  /** True if we stopped because the server/network can't be reached right now (or the session expired) */
  offline: boolean;
}

function read(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist; returns false if the device refused (storage full/blocked) — callers must not claim "saved" then. */
function write(items: OutboxItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  refresh(items);
  return true;
}

function refresh(all: OutboxItem[]) {
  snapshot = currentUser ? all.filter((i) => i.userId === currentUser) : [];
  listeners.forEach((l) => l());
}

// Another tab changed the queue → keep this tab's view (and its banner) in step
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) refresh(read()); });
}

/** Tell the outbox whose data it is (null = signed out). Only that user's items are visible or replayed. */
export function setOutboxUser(userId: string | null) {
  currentUser = userId;
  refresh(read());
}

/** Everything queued for the current user, waiting and failed. */
export function pendingItems(): OutboxItem[] {
  return snapshot;
}

export function subscribeOutbox(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function newClientId(): string {
  return crypto.randomUUID();
}

/**
 * Queue a write. Returns the stored item, or null when it can't be stored safely (nobody signed in, queue full, or
 * the device refused the write) — the caller then shows the offline error instead of claiming it was saved.
 * Queuing the same id twice keeps one entry.
 */
export function enqueue(item: Omit<OutboxItem, "userId" | "createdAt" | "status" | "error">): OutboxItem | null {
  if (!currentUser) return null;
  const all = read();
  const existing = all.find((i) => i.id === item.id && i.userId === currentUser);
  if (existing) return existing;
  if (all.filter((i) => i.userId === currentUser).length >= MAX_QUEUED) return null;
  const full: OutboxItem = { ...item, userId: currentUser, createdAt: Date.now(), status: "pending" };
  return write([...all, full]) ? full : null;
}

/** Remove one item — only after the server confirmed it, or when the user explicitly discards it. */
export function removeItem(id: string) {
  write(read().filter((i) => !(i.id === id && i.userId === currentUser)));
}

function patch(id: string, changes: Partial<OutboxItem>) {
  write(read().map((i) => (i.id === id && i.userId === currentUser ? { ...i, ...changes } : i)));
}

/** Put a failed item back in the queue to be sent again. */
export function retryItem(id: string) {
  patch(id, { status: "pending", error: undefined });
}

/** Wipe everything (sign-out / switching accounts): queued writes must never be sent as someone else. */
export function clearOutbox() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  refresh([]);
}

/** 4xx the server will give again for the same request. 401/408/429 are NOT final (sign in again / slow down). */
function isPermanent(status: number) {
  return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
}

/** Replay the current user's waiting writes in order. Safe to call repeatedly; overlapping calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { synced: [], failed: [], offline: false };
    const user = currentUser;
    for (const queued of [...snapshot]) {
      if (queued.status === "failed") continue;
      // Another tab may have sent it already since we looked: re-read before sending
      const stillThere = read().some((i) => i.id === queued.id && i.userId === user && i.status !== "failed");
      if (!stillThere) continue;
      if (user !== currentUser) break; // signed out / switched account mid-flush: stop immediately

      try {
        const res = await fetch(queued.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...queued.body, clientId: queued.id }),
        });
        let json: { data?: unknown; error?: { message?: string } } | null = null;
        try { json = await res.json(); } catch { /* not JSON */ }

        if (res.ok && json && typeof json === "object" && "data" in json && !json.error) {
          result.synced.push(queued);
          removeItem(queued.id);
        } else if (res.ok) {
          // 2xx but not an API reply (captive portal, proxy page): we can't tell it was saved — keep and retry
          result.offline = true;
          break;
        } else if (isPermanent(res.status)) {
          const message = json?.error?.message ?? `Request failed (${res.status})`;
          patch(queued.id, { status: "failed", error: message });
          result.failed.push({ item: queued, message });
        } else {
          // 5xx / 429 / 408 / 401: try again later, keep order
          result.offline = true;
          break;
        }
      } catch (e) {
        if (isNetworkError(e)) { result.offline = true; break; }
        throw e;
      }
    }
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}
