"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useInAppBrowser, usePlatform } from "@/hooks/use-platform";

/**
 * Google refuses sign-in inside the embedded browsers of apps like Instagram and Facebook — and WhatsApp/Instagram are
 * exactly where invite links get opened. Say so up front and show how to continue, instead of a confusing Google error.
 */
export function InAppBrowserNotice() {
  const inApp = useInAppBrowser();
  const platform = usePlatform();
  const [copied, setCopied] = useState(false);
  if (!inApp) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* blocked: the user can still pick "Open in browser" from the app's menu */ }
  };

  return (
    <div role="note" data-testid="inapp-notice" className="rounded-xl border border-amber-400/50 bg-amber-100/70 p-3 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="mb-1 flex items-center gap-1.5 font-semibold"><ExternalLink className="size-3.5" /> You&apos;re in another app&apos;s browser</p>
      <p>
        Google sign-in doesn&apos;t work here. Use your email below, or open this page in{" "}
        <b>{platform === "ios" ? "Safari" : "Chrome"}</b> (menu → &ldquo;Open in browser&rdquo;).
        <button type="button" onClick={copy} className="ml-1.5 font-semibold underline underline-offset-2">{copied ? "Copied!" : "Copy link"}</button>
      </p>
    </div>
  );
}
