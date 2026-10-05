/**
 * A small sliding-window rate limiter, kept in memory.
 *
 * What it is for: stopping one client (a bug that retries in a loop, a script, someone guessing invite links) from using
 * up a server instance for everyone else. Each server instance counts on its own, so this is a safety net against
 * bursts, not an exact global quota — for that, add the host's firewall rules or a shared store (e.g. Redis) behind the
 * same `rateLimit()` call. It is bounded: it never holds more than MAX_KEYS clients, so it can't become a memory leak.
 */
interface Bucket { hits: number[] }

const MAX_KEYS = 5_000;
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** requests left in the current window */
  remaining: number;
  /** seconds until a request would be allowed again (0 when ok) */
  retryAfter: number;
}

/** Counts a request for `key` and says whether it is within `max` requests per `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  const since = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > since);

  if (bucket.hits.length >= max) {
    buckets.delete(key); // re-insert below so the busiest keys stay "newest" for eviction purposes
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000)) };
  }

  bucket.hits.push(now);
  buckets.delete(key);
  buckets.set(key, bucket);

  if (buckets.size > MAX_KEYS) {
    // drop the least recently used clients first (Map keeps insertion order)
    for (const k of buckets.keys()) {
      if (buckets.size <= MAX_KEYS * 0.9) break;
      buckets.delete(k);
    }
  }
  return { ok: true, remaining: max - bucket.hits.length, retryAfter: 0 };
}

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}

export const rateLimitSize = () => buckets.size;
