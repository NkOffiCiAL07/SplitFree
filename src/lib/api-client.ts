/** Thrown instead of a raw "TypeError: Failed to fetch" when the device has no connection. */
export class OfflineError extends Error {
  constructor() {
    super("You're offline — this needs a connection. Try again when you're back online.");
    this.name = "OfflineError";
  }
}

/** True for failures that mean "the network was unavailable" (worth retrying), not "the server said no". */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof OfflineError) return true;
  // fetch() rejects with a TypeError when there's no connection / DNS / CORS-level failure
  return e instanceof TypeError;
}

/**
 * Shared JSON API call. Returns `json.data`; throws the server's message for API errors, and an
 * OfflineError (not a cryptic TypeError) when there is no connection — so offline-only failures read well.
 */
export async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new OfflineError();
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (isNetworkError(e)) throw new OfflineError();
    throw e;
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}
