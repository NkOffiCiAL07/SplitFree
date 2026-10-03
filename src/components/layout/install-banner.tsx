"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { ANDROID_APP } from "@/lib/android-app";
import { detectPlatform, isInAppBrowser, isIosSafari, isStandalone } from "@/lib/platform";

const DISMISS_KEY = "splitfree-install-dismissed";
const VISITS_KEY = "splitfree-visits";
const CHANGE_EVENT = "splitfree-install-change";
export const DISMISS_DAYS = 30;

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE_EVENT, cb); };
}

type Kind = "ios" | "android" | "";

/** Which install nudge (if any) to show right now. Never shown inside the installed app or in-app browsers. */
export function installKind(now = Date.now()): Kind {
  const ua = navigator.userAgent;
  if (isStandalone() || isInAppBrowser(ua)) return "";
  const dismissedAt = Number(safeGet(DISMISS_KEY) ?? 0);
  if (dismissedAt && now - dismissedAt < DISMISS_DAYS * 86_400_000) return "";
  if (Number(safeGet(VISITS_KEY) ?? 0) < 2) return ""; // not on someone's very first visit
  const platform = detectPlatform(ua, navigator.maxTouchPoints);
  if (platform === "ios") return isIosSafari(ua) ? "ios" : "";
  if (platform === "android") return "android";
  return "";
}

/**
 * A polite, dismissible nudge to install: the Android app, or Add to Home Screen on iPhone (no native iOS app yet).
 * Appears from the second visit, never inside the installed app, and stays away for 30 days once dismissed.
 */
export function InstallBanner() {
  const kind = useSyncExternalStore<Kind>(subscribe, () => installKind(), () => "");

  // Count a visit once per browser session
  useEffect(() => {
    try {
      if (sessionStorage.getItem("splitfree-counted")) return;
      sessionStorage.setItem("splitfree-counted", "1");
    } catch { return; }
    safeSet(VISITS_KEY, String(Number(safeGet(VISITS_KEY) ?? 0) + 1));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  if (!kind) return null;
  const dismiss = () => { safeSet(DISMISS_KEY, String(Date.now())); window.dispatchEvent(new Event(CHANGE_EVENT)); };

  return (
    <div role="region" aria-label="Install the app" data-testid="install-banner" data-kind={kind} className="lg-glass mx-3 mt-2 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm lg:hidden">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl gradient-brand text-white">
        {kind === "ios" ? <PlusSquare className="size-4" /> : <Download className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        {kind === "android" ? (
          <>
            <p className="font-semibold">Get the Android app</p>
            <p className="text-xs text-muted-foreground">Full-screen, faster to open, and opens invite links right inside the app.</p>
            <a href={ANDROID_APP.path} download={ANDROID_APP.fileName} className="mt-2 inline-flex h-8 items-center rounded-lg gradient-brand px-3 text-xs font-semibold text-white">
              Download
            </a>
          </>
        ) : (
          <>
            <p className="font-semibold">Add Splitr Pro to your Home Screen</p>
            <p className="text-xs text-muted-foreground">
              Tap <Share className="mx-0.5 inline size-3.5 align-text-bottom" aria-label="Share" /> then <b>Add to Home Screen</b> — full-screen, works offline, and notifications turn on.
            </p>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
        <X className="size-4" />
      </button>
    </div>
  );
}
