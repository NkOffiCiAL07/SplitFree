"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { Camera, CheckCircle2, Share2, UserPlus } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

const POINTS = [
  { icon: Camera, text: "Works with the normal camera app on any phone" },
  { icon: UserPlus, text: "New to Splitr? They sign up and land straight in your group" },
  { icon: Share2, text: "Save the code as an image and share it anywhere — WhatsApp, a poster, a fridge door" },
];

const origin = () => window.location.origin;

/** "Join a group by scanning a QR code": the real code on the card opens this site, so people can try scanning it right here. */
export function QrJoinShowcase({ trip = "Goa trip" }: { trip?: string }) {
  const site = useSyncExternalStore(() => () => {}, origin, () => "");

  return (
    <section id="scan-to-join" aria-labelledby="scan-to-join-title" className="scroll-mt-16 px-4 py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400">
            <span className="h-px w-4 bg-violet-500/50" /> Scan to join
          </p>
          <h2 id="scan-to-join-title" className="text-3xl font-bold sm:text-4xl">Join a group by scanning a QR code</h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Open a group, tap <strong className="text-foreground">Invite</strong>{" "}
            and show its QR code. Friends point their phone at it and they&apos;re in — no typing, no link to paste.
          </p>
          <ul className="mt-6 space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150} className="relative mx-auto w-full max-w-xs">
          <div aria-hidden="true" className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-violet-400/30 via-sky-300/20 to-fuchsia-300/30 blur-2xl" />
          <div className="relative overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-violet-500/20">
            <div className="gradient-brand px-5 py-4 text-center text-white">
              <p className="text-3xl" aria-hidden="true">🏖️</p>
              <p className="mt-1 font-bold">{trip}</p>
              <p className="text-xs text-white/75">Scan the code to join</p>
            </div>
            <div className="flex items-center justify-center p-6">
              <div className="rounded-2xl bg-white p-3 shadow-inner ring-1 ring-black/5">
                {site ? (
                  <QRCodeSVG value={site} size={176} level="M" marginSize={0} fgColor="#6d28d9" />
                ) : (
                  <div className="size-[176px] animate-pulse rounded-lg bg-muted" />
                )}
              </div>
            </div>
          </div>
          <div className="lg-glass lg-float absolute -bottom-5 -right-3 z-10 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs shadow-xl sm:-right-8">
            <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
            <span><b className="font-semibold">Priya</b> joined {trip}</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
