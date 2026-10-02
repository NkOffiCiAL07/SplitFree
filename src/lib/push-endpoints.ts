/**
 * Web Push endpoints are chosen by the client, and the server POSTs to them. Without an allow-list
 * a user could register `https://internal-service/...` and turn the server into a request proxy,
 * so only the real browser push services are accepted.
 */
const ALLOWED_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome, Edge, Brave, Opera, Samsung
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari / iOS web push (web.push.apple.com)
  "notify.windows.com", // legacy Edge / WNS
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
