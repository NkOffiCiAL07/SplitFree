"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Bell, Check, Copy, PlusSquare, Share, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import { ANDROID_APP, androidSizeLabel } from "@/lib/android-app";
import { detectPlatform, isInAppBrowser, type Platform } from "@/lib/platform";
import { AndroidDownloadButton, IosComingSoon } from "@/components/landing/store-badges";
import { cn } from "@/lib/utils";

// The QR library is only needed here, and only on screens that can't tap the download button themselves
const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

const noopSubscribe = () => () => {};
type Tab = "android" | "iphone";

const ANDROID_STEPS = [
  "Tap Download. If your browser warns about the file, choose Download anyway.",
  "Open the file. When Android asks, allow “Install unknown apps” for your browser (one-time).",
  "Tap Install, open Splitr Pro and sign in with your existing account.",
];

export function DownloadPanel() {
  // Read from the browser without an effect: the server render (and first paint) assume "desktop"
  const platform = useSyncExternalStore<Platform>(noopSubscribe, () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints), () => "desktop");
  const inApp = useSyncExternalStore(noopSubscribe, () => isInAppBrowser(navigator.userAgent), () => false);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [choice, setChoice] = useState<Tab | null>(null);
  const [copied, setCopied] = useState<"hash" | "link" | null>(null);
  const tab: Tab = choice ?? (platform === "ios" ? "iphone" : "android");

  const copy = async (text: string, what: "hash" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard blocked: the text is still selectable on screen */ }
  };

  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Choose your phone" className="lg-glass-dark inline-flex rounded-full p-1">
        {([["android", "Android"], ["iphone", "iPhone"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setChoice(id)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-semibold transition-all",
              tab === id ? "bg-white text-violet-700 shadow" : "text-white/80 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "android" ? (
        <div role="tabpanel" id="panel-android" aria-labelledby="tab-android" className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <AndroidDownloadButton tone="light" />
              <IosComingSoon tone="light" />
            </div>
            <p className="text-sm text-white/70" data-testid="platform-hint">
              {platform === "android" && "You're on Android — tap Download to install the app."}
              {platform === "ios" && "On iPhone? Switch to the iPhone tab — the full app already works from your home screen, and a native iOS app is coming soon."}
              {platform === "desktop" && "On a computer? Scan the code with your Android phone. iPhone users can open this site in Safari and use Add to Home Screen — a native iOS app is coming soon."}
            </p>

            <ol className="space-y-3">
              {ANDROID_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-white/85">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="lg-glass-dark rounded-xl p-3 text-xs text-white/80">
              <p className="mb-1.5 flex items-center gap-1.5 font-medium text-white">
                <ShieldCheck className="size-3.5 text-emerald-300" /> Signed release · {androidSizeLabel} · package {ANDROID_APP.packageName}
              </p>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-relaxed" data-testid="apk-sha256">SHA-256 {ANDROID_APP.sha256}</code>
                <button
                  type="button"
                  onClick={() => copy(ANDROID_APP.sha256, "hash")}
                  aria-label="Copy SHA-256 checksum"
                  className="shrink-0 rounded-md border border-white/20 p-1.5 transition-colors hover:bg-white/10"
                >
                  {copied === "hash" ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            {platform === "desktop" && origin ? (
              <figure className="lg-float rounded-3xl bg-white p-5 text-center shadow-2xl ring-8 ring-white/20" data-testid="download-qr">
                <QRCodeSVG value={`${origin}${ANDROID_APP.path}`} size={176} level="M" marginSize={0} />
                <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600">
                  <Smartphone className="size-3.5" /> Scan to download on Android
                </figcaption>
              </figure>
            ) : (
              <div className="lg-glass-dark lg-float rounded-3xl p-8 text-center" aria-hidden="true">
                <Smartphone className="mx-auto size-16 opacity-90" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="panel-iphone" aria-labelledby="tab-iphone" className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <IosComingSoon tone="light" />
              <span className="text-sm text-white/80">Native iOS app coming soon — until then, add it to your home screen (30 seconds):</span>
            </div>

            {inApp && (
              <div role="alert" data-testid="ios-inapp-warning" className="rounded-xl border border-amber-300/50 bg-amber-300/15 p-3 text-sm text-amber-100">
                You&apos;re inside another app&apos;s browser, which can&apos;t add to the home screen. Copy this page&apos;s link and open it in <b>Safari</b>.
                <button type="button" onClick={() => copy(origin || "", "link")} className="ml-2 font-semibold underline underline-offset-2">
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}

            <ol className="space-y-3" data-testid="ios-steps">
              {[
                { icon: null, text: <>Open <b>{origin ? origin.replace(/^https?:\/\//, "") : "this site"}</b> in <b>Safari</b> (the blue compass).</> },
                { icon: Share, text: <>Tap the <b>Share</b> button at the bottom of the screen.</> },
                { icon: PlusSquare, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
                { icon: Check, text: <>Tap <b>Add</b>. Splitr Pro now opens full-screen like any other app.</> },
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{i + 1}</span>
                  <span className="flex-1">{s.text}</span>
                  {s.icon && <s.icon className="mt-0.5 size-5 shrink-0 text-cyan-200" aria-hidden="true" />}
                </li>
              ))}
            </ol>

            <ul className="grid gap-2 text-xs text-white/85 sm:grid-cols-2">
              <li className="lg-glass-dark flex items-center gap-2 rounded-xl px-3 py-2"><WifiOff className="size-4 shrink-0 text-cyan-200" /> Works offline, like the Android app</li>
              <li className="lg-glass-dark flex items-center gap-2 rounded-xl px-3 py-2"><Bell className="size-4 shrink-0 text-cyan-200" /> Notifications once it&apos;s on your home screen (iOS 16.4+)</li>
            </ul>
            <p className="text-sm text-white/70" data-testid="platform-hint">
              {platform === "ios"
                ? "You're on iPhone — follow the steps above. A native iOS app is coming soon."
                : "On a computer? Scan the code with your iPhone camera. A native iOS app is coming soon."}
            </p>
          </div>

          <div className="flex justify-center">
            {platform === "desktop" && origin ? (
              <figure className="lg-float rounded-3xl bg-white p-5 text-center shadow-2xl ring-8 ring-white/20" data-testid="download-qr-ios">
                <QRCodeSVG value={origin} size={176} level="M" marginSize={0} />
                <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600">
                  <Smartphone className="size-3.5" /> Scan with your iPhone camera
                </figcaption>
              </figure>
            ) : (
              <div className="lg-glass-dark lg-float rounded-3xl p-8 text-center" aria-hidden="true">
                <Share className="mx-auto size-14 opacity-90" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
