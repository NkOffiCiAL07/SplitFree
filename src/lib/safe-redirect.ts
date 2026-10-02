/**
 * Only allow redirects to paths inside this app. `next` comes from the query string, and values like
 * `@evil.com` or `//evil.com` would turn `${origin}${next}` into a link to another site.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://localhost");
    if (u.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
