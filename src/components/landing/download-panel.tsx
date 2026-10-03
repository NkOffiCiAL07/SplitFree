"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ShieldCheck, Smartphone } from "lucide-react";
import { ANDROID_APP, androidSizeLabel } from "@/lib/android-app";
import { AndroidDownloadButton, IosComingSoon } from "@/components/landing/store-badges";

// The QR library is only needed here, and only on screens that can't tap the download button themselves
const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

type Platform = "android" | "ios" | "desktop";

function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

const noopSubscribe = () => () => {};

const STEPS = [
  "Tap Download. If your browser warns about the file, choose Download anyway.",
  "Open the file. When Android asks, allow “Install unknown apps” for your browser (one-time).",
  "Tap Install, open Splitr Pro and sign in with your existing account.",
];

export function DownloadPanel() {
  // Read from the browser without an effect: the server render (and first paint) assume "desktop"
  const platform = useSyncExternalStore<Platform>(noopSubscribe, () => detectPlatform(navigator.userAgent), () => "desktop");
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(ANDROID_APP.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the hash is still selectable on screen */ }
  };

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <AndroidDownloadButton tone="light" />
          <IosComingSoon tone="light" />
        </div>
        <p className="text-sm text-white/70" data-testid="platform-hint">
          {platform === "android" && "You're on Android — tap Download to install the app."}
          {platform === "ios" && "On iPhone? The full app already works in Safari: tap Share → Add to Home Screen. A native iOS app is coming soon."}
          {platform === "desktop" && "On a computer? Scan the code with your Android phone. iPhone users can open this site in Safari and use Add to Home Screen — a native iOS app is coming soon."}
        </p>

        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-white/85">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-white/75">
          <p className="mb-1.5 flex items-center gap-1.5 font-medium text-white">
            <ShieldCheck className="size-3.5 text-emerald-300" /> Signed release · {androidSizeLabel} · package {ANDROID_APP.packageName}
          </p>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-relaxed" data-testid="apk-sha256">SHA-256 {ANDROID_APP.sha256}</code>
            <button
              type="button"
              onClick={copyHash}
              aria-label="Copy SHA-256 checksum"
              className="shrink-0 rounded-md border border-white/20 p-1.5 transition-colors hover:bg-white/10"
            >
              {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        {platform === "desktop" && origin ? (
          <figure className="rounded-3xl bg-white p-5 text-center shadow-2xl" data-testid="download-qr">
            <QRCodeSVG value={`${origin}${ANDROID_APP.path}`} size={176} level="M" marginSize={0} />
            <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600">
              <Smartphone className="size-3.5" /> Scan to download on Android
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-3xl bg-white/10 p-8 text-center text-white backdrop-blur" aria-hidden="true">
            <Smartphone className="mx-auto size-16 opacity-90" />
          </div>
        )}
      </div>
    </div>
  );
}
