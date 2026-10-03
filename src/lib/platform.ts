/**
 * Which kind of device/browser is this? Drives install guidance (Android app, iPhone Add to Home Screen),
 * UPI app links and the in-app-browser warning. Pure functions of the user agent so they're easy to test.
 */
export type Platform = "android" | "ios" | "desktop";

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac but has a touch screen
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

/**
 * Apps' own browsers (Instagram, Facebook, LinkedIn, Snapchat, Line, Twitter/X, Gmail…). Many can't "Add to Home
 * Screen" or install apps, and Google refuses sign-in inside embedded web views — so people should open the real browser.
 */
export function isInAppBrowser(ua: string): boolean {
  if (ua.includes("SplitrProApp")) return false; // our own iPhone app is not "someone else's browser"
  if (/FBAN|FBAV|FB_IAB|Instagram|Snapchat|LinkedInApp|Line\/|Twitter|TikTok|musical_ly|Pinterest|MicroMessenger|GSA\/.*Mobile.*Safari.*Version/i.test(ua)) return true;
  // Android WebView: has "; wv)" in the user agent
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return true;
  // iOS web views lack the "Safari/" token that real Safari and Chrome-on-iOS include
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return true;
  return false;
}

/** Running as an installed app: iOS home-screen app, Android PWA, or our Trusted Web Activity APK. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.userAgent.includes("SplitrProApp")) return true; // the iPhone app
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    document.referrer.startsWith("android-app://")
  );
}

/** Real iPhone/iPad Safari (not Chrome/Firefox/Edge on iOS, which can't add to the home screen the same way). */
export function isIosSafari(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) && /Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
}
