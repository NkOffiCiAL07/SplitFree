"use client";

import { useSyncExternalStore } from "react";
import { detectPlatform, isInAppBrowser, isIosSafari, isStandalone, type Platform } from "@/lib/platform";
import { isNativeApp, isNativeUserAgent } from "@/lib/native";

const noop = () => () => {};

/** What device/browser this is, read from the browser without an effect (server render assumes "desktop"). */
export function usePlatform(): Platform {
  return useSyncExternalStore<Platform>(noop, () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints), () => "desktop");
}

/** True inside Instagram / Facebook / WebView-style browsers, where Google sign-in and installing don't work. */
export function useInAppBrowser(): boolean {
  return useSyncExternalStore(noop, () => isInAppBrowser(navigator.userAgent), () => false);
}

/** Real Safari on iPhone/iPad. */
export function useIosSafari(): boolean {
  return useSyncExternalStore(noop, () => isIosSafari(navigator.userAgent), () => false);
}

/** Running as an installed app (home-screen app, PWA or our Android app). */
export function useStandalone(): boolean {
  return useSyncExternalStore(noop, () => isStandalone(), () => false);
}

/** True inside our iPhone app (not a browser). Google sign-in and install prompts are hidden there. */
export function useNativeApp(): boolean {
  return useSyncExternalStore(noop, () => isNativeApp() || isNativeUserAgent(navigator.userAgent), () => false);
}
