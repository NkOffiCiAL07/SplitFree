/**
 * Keeps React Query's cache on the device (IndexedDB) so the app opens offline with the data you last saw.
 * The snapshot belongs to one user and is discarded for anyone else; it is wiped on sign-out.
 */
import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { idbDelete, idbGet, idbSet } from "./idb";

const KEY = "query-cache";
export const CACHE_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a week-old snapshot is better than nothing offline, but not forever
const SAVE_DELAY_MS = 1000;

/** Data worth keeping offline. Nothing sensitive beyond what the user already sees on screen. */
const PERSISTED_ROOTS = new Set(["dashboard", "groups", "balances", "balance", "friends", "expenses", "settlements", "activity", "analytics", "profile", "budget", "notifications"]);

interface Snapshot {
  version: number;
  userId: string;
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

export async function restoreQueryCache(qc: QueryClient, userId: string): Promise<boolean> {
  const snap = await idbGet<Snapshot>(KEY);
  if (!snap || snap.version !== CACHE_VERSION || snap.userId !== userId || Date.now() - snap.savedAt > MAX_AGE_MS) {
    if (snap) await idbDelete(KEY); // someone else's / stale / old format
    return false;
  }
  hydrate(qc, snap.state);
  return true;
}

export async function saveQueryCache(qc: QueryClient, userId: string) {
  const state = dehydrate(qc, {
    shouldDehydrateQuery: (q) => q.state.status === "success" && PERSISTED_ROOTS.has(String(q.queryKey[0])),
  });
  await idbSet(KEY, { version: CACHE_VERSION, userId, savedAt: Date.now(), state } satisfies Snapshot);
}

export async function clearQueryCache() {
  await idbDelete(KEY);
}

/** Restore, then keep saving (debounced) whenever the cache changes. Returns an unsubscribe function. */
export async function startQueryPersistence(qc: QueryClient, userId: string): Promise<() => void> {
  await restoreQueryCache(qc, userId).catch(() => false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = qc.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { saveQueryCache(qc, userId).catch(() => {}); }, SAVE_DELAY_MS);
  });
  return () => { clearTimeout(timer); unsubscribe(); };
}
