import type { Metadata } from "next";
import { Check, Zap } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { FillProvider } from "@/components/auth/fill-context";
import { FillingPot } from "@/components/auth/filling-pot";
import { RotatingWords } from "@/components/landing/rotating-words";
import { HEADLINE, HEADLINE_LINE_1, HEADLINE_LINE_2, SUBLINE, OCCASIONS } from "@/lib/brand-copy";

export const metadata: Metadata = {
  title: "Sign in",
};

const TRUST = ["Free forever", "No ads", "Works offline"];

function Backdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="lg-blob -left-24 top-8 h-[420px] w-[420px] bg-cyan-400/50" />
      <div className="lg-blob lg-blob-2 -right-20 top-1/3 h-[460px] w-[460px] bg-fuchsia-500/45" />
      <div className="lg-blob lg-blob-3 bottom-[-120px] left-1/4 h-[400px] w-[400px] bg-indigo-400/50" />
      <div className="lg-blob lg-blob-2 right-1/4 top-[-90px] h-[260px] w-[260px] bg-amber-300/30" />
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <FillProvider>
      <div className="flex min-h-dvh">
        {/* Left — liquid-glass brand panel (desktop) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-800 to-fuchsia-800 p-10 lg:flex lg:w-1/2 xl:p-12">
          <Backdrop />

          <div className="anim-fade-up relative z-10">
            <div className="lg-glass-dark inline-flex items-center gap-3 rounded-2xl px-4 py-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white">
                <Zap className="size-4 text-violet-600" />
              </div>
              <span className="text-xl font-semibold">{APP_NAME}</span>
            </div>
          </div>

          {/* The glass pot fills as the form is filled in; chips drift around it */}
          <div className="relative z-10 flex flex-1 items-center justify-center py-4">
            <div className="relative">
              <FillingPot size="lg" />
              <div className="lg-glass-dark lg-float absolute -left-[62%] top-[8%] hidden items-center gap-2 rounded-2xl px-3.5 py-2 text-xs xl:flex">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/90 text-[11px] text-emerald-950">✓</span>
                <span><b className="font-semibold">Asha</b> paid you ₹850</span>
              </div>
              <div className="lg-glass-dark lg-float-2 absolute -right-[70%] top-[40%] hidden items-center gap-2 rounded-2xl px-3.5 py-2 text-xs xl:flex">
                <span aria-hidden="true">🏖️</span>
                <span>Goa trip — <b className="font-semibold">all settled</b></span>
              </div>
              <div className="lg-glass-dark lg-float-3 absolute -left-[50%] bottom-[22%] hidden items-center gap-2 rounded-2xl px-3.5 py-2 text-xs xl:flex">
                <span aria-hidden="true">⚡</span>
                <span>10 payments → <b className="font-semibold">3</b></span>
              </div>
            </div>
          </div>

          <div className="relative z-10 space-y-4 text-white">
            <h2 className="anim-fade-up text-3xl font-bold leading-[1.1] tracking-tight xl:text-5xl [@media(max-height:820px)]:xl:text-4xl" style={{ animationDelay: "80ms" }}>
              {HEADLINE_LINE_1}
              <span className="block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">{HEADLINE_LINE_2}</span>
            </h2>
            <p className="anim-fade-up max-w-md text-sm leading-relaxed text-white/80 xl:text-lg [@media(max-height:820px)]:xl:text-base" style={{ animationDelay: "160ms" }}>
              {SUBLINE}
            </p>
            <p className="anim-fade-up text-sm text-white/75" style={{ animationDelay: "240ms" }}>
              Made for <RotatingWords words={OCCASIONS} className="font-semibold text-white" />
            </p>
            <ul className="anim-fade-up flex flex-wrap gap-2 text-xs font-medium" style={{ animationDelay: "320ms" }}>
              {TRUST.map((t) => (
                <li key={t} className="lg-glass-dark flex items-center gap-1.5 rounded-full px-3 py-1.5">
                  <Check className="size-3" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — frosted-glass form over soft liquid colour */}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="lg-blob -right-24 -top-24 h-80 w-80 bg-violet-400/45" />
            <div className="lg-blob lg-blob-2 -bottom-24 -left-16 h-80 w-80 bg-sky-300/50" />
            <div className="lg-blob lg-blob-3 bottom-10 right-10 h-56 w-56 bg-fuchsia-300/40" />
          </div>

          {/* Welcome for phones and tablets (also what the Android app shows when signed out) */}
          <section
            aria-label="Welcome"
            data-testid="welcome"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-6 text-white shadow-xl shadow-violet-500/25 lg:hidden"
          >
            <Backdrop className="opacity-80" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white">
                  <Zap className="size-4 text-violet-600" />
                </div>
                <span className="text-lg font-semibold">{APP_NAME}</span>
              </div>
              <div className="float-right -mt-1 ml-2">
                <FillingPot size="sm" />
              </div>
              <p className="text-2xl font-bold leading-tight">{HEADLINE}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{SUBLINE}</p>
              <p className="mt-3 text-xs text-white/75">
                Made for <RotatingWords words={OCCASIONS} className="font-semibold text-white" />
              </p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                {["UPI pay links", "Works offline", "Smart settle-up", "No ads"].map((t) => (
                  <li key={t} className="lg-glass-dark flex items-center gap-1 rounded-full px-2.5 py-1">
                    <Check className="size-3" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="lg-glass anim-fade-up relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8" style={{ animationDelay: "120ms" }}>
            {children}
          </div>
        </div>
      </div>
    </FillProvider>
  );
}
