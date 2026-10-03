/**
 * Offline outbox: writes made without a connection are queued here (localStorage — small, synchronous, survives
 * reloads) and replayed in order when the connection returns. Every queued request carries a client-generated id
 * (`clientId`) that the server treats idempotently, so a replay can never create a duplicate.
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
}

const KEY = "splitfree-outbox-v1";
const listeners = new Set<() => void>();
let currentUser: string | null = null;
let snapshot: OutboxItem[] = [];
let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  synced: OutboxItem[];
  /** Items the server rejected for good (e.g. group archived) — dropped from the queue */
  failed: { item: OutboxItem; message: string }[];
  /** True if we stopped because the connection dropped again */
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

function write(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / blocked — the in-memory snapshot still drives this session */
  }
  refresh(items);
}

function refresh(all: OutboxItem[]) {
  snapshot = currentUser ? all.filter((i) => i.userId === currentUser) : [];
  listeners.forEach((l) => l());
}

/** Tell the outbox whose data it is (null = signed out). Only that user's items are visible or replayed. */
export function setOutboxUser(userId: string | null) {
  currentUser = userId;
  refresh(read());
}

export function getOutboxUser() {
  return currentUser;
}

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

export function enqueue(item: Omit<OutboxItem, "userId" | "createdAt">): OutboxItem | null {
  if (!currentUser) return null; // can't attribute it to anyone — let the caller surface the offline error
  const full: OutboxItem = { ...item, userId: currentUser, createdAt: Date.now() };
  write([...read(), full]);
  return full;
}

export function removeItem(id: string) {
  write(read().filter((i) => i.id !== id));
}

/** Wipe everything (sign-out / switching accounts): queued writes must never be sent as someone else. */
export function clearOutbox() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  refresh([]);
}

/** Server said "no" for a reason retrying can't fix (vs. network trouble, rate limits and 5xx, which can be retried). */
function isPermanent(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Replay the current user's queued writes in order. Safe to call repeatedly; overlapping calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { synced: [], failed: [], offline: false };
    for (const item of [...snapshot]) {
      try {
        const res = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item.body, clientId: item.id }),
        });
        let message = `Request failed (${res.status})`;
        try { const json = await res.json(); if (json?.error?.message) message = json.error.message; } catch { /* non-JSON */ }
        if (res.ok) {
          result.synced.push(item);
          removeItem(item.id);
        } else if (isPermanent(res.status)) {
          result.failed.push({ item, message });
          removeItem(item.id);
        } else {
          // 5xx / 429 / 408: try again later, keep order
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
