import { Capacitor } from "@capacitor/core";

/** Appended to the web view's user agent by the iOS app (capacitor.config.ts → ios.appendUserAgent). */
export const NATIVE_UA_TOKEN = "SplitrProApp";

/** True when running inside the iPhone (Capacitor) app rather than a browser. Safe to call on the server (false). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Same check from a user-agent string (works before/without the Capacitor bridge, and for the server). */
export function isNativeUserAgent(ua: string): boolean {
  return ua.includes(NATIVE_UA_TOKEN);
}

export const nativePlatform = (): "ios" | "android" | "web" => {
  try { return Capacitor.getPlatform() as "ios" | "android" | "web"; } catch { return "web"; }
};

/** Pages with the purple brand header: the status bar needs light (white) text there. */
const BRAND_HEADER_PATHS = ["/login", "/signup", "/reset-password"];
export const hasBrandHeader = (pathname: string) => BRAND_HEADER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Turns a link the app was opened with (universal link https://…/join/abc, or splitrpro://join/abc) into an in-app
 * path. Anything pointing at another site returns null (it is not ours to navigate to).
 */
export function deepLinkToPath(url: string, appHost: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "splitrpro:") {
      // splitrpro://join/abc → host "join", pathname "/abc"
      return `/${u.host}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
    }
    if ((u.protocol === "https:" || u.protocol === "http:") && u.host === appHost) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return null;
  } catch {
    return null;
  }
}
