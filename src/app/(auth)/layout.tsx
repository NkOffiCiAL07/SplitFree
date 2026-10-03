import { BrandLogo } from "@/components/shared/brand-logo";
import type { Metadata, Viewport } from "next";
import { Check } from "lucide-react";
import { FillProvider } from "@/components/auth/fill-context";
import { FillingPot } from "@/components/auth/filling-pot";
import { RotatingWords } from "@/components/landing/rotating-words";
import { HEADLINE_LINE_1, HEADLINE_LINE_2, SUBLINE, OCCASIONS } from "@/lib/brand-copy";

export const metadata: Metadata = {
  title: "Sign in",
};

// The phone status bar takes the header's colour (no white strip above the purple header)
export const viewport: Viewport = {
  themeColor: "#6d28d9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
            <BrandLogo size={48} tone="light" />
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

        {/* Right — on phones: a compact brand header with the form sheet right under it (no scrolling to sign in);
            on desktop: a frosted-glass card over soft liquid colour */}
        <div className="relative flex flex-1 flex-col items-center justify-start overflow-hidden bg-gradient-to-b from-violet-700 via-indigo-700 to-fuchsia-700 lg:justify-center lg:gap-6 lg:bg-gradient-to-br lg:from-violet-50 lg:via-white lg:to-sky-50 lg:p-6 dark:lg:from-zinc-950 dark:lg:via-zinc-950 dark:lg:to-violet-950/40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
            <div className="lg-blob -right-24 -top-24 h-80 w-80 bg-violet-400/45" />
            <div className="lg-blob lg-blob-2 -bottom-24 -left-16 h-80 w-80 bg-sky-300/50" />
            <div className="lg-blob lg-blob-3 bottom-10 right-10 h-56 w-56 bg-fuchsia-300/40" />
          </div>
          <Backdrop className="lg:hidden" />

          {/* Phone header: compact, so the form is visible straight away (also what the Android app shows signed out) */}
          <section
            aria-label="Welcome"
            data-testid="welcome"
            className="relative z-10 w-full px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white lg:hidden [@media(min-height:800px)]:pb-8 [@media(min-height:800px)]:pt-[max(2.5rem,env(safe-area-inset-top))]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <BrandLogo size={38} tone="light" className="mb-3" />
                <p className="text-[1.65rem] font-bold leading-[1.1] tracking-tight">
                  {HEADLINE_LINE_1}{" "}
                  <span className="block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">{HEADLINE_LINE_2}</span>
                </p>
              </div>
              <FillingPot size="sm" className="shrink-0 scale-110" />
            </div>
            <p className="mt-2 hidden text-sm leading-relaxed text-white/80 min-[400px]:[@media(min-height:780px)]:block">{SUBLINE}</p>
            <p className="mt-2 text-xs text-white/80 [@media(max-height:640px)]:hidden">
              Made for <RotatingWords words={OCCASIONS} className="font-semibold text-white" />
            </p>
          </section>

          <div
            className="lg-glass anim-fade-up relative z-10 flex w-full flex-1 flex-col rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 max-lg:border-0 max-lg:bg-background! max-lg:bg-none! max-lg:backdrop-filter-none! max-lg:shadow-[0_-18px_50px_-18px_rgba(30,10,80,0.5)]! lg:max-w-md lg:flex-none lg:rounded-3xl lg:p-8"
            style={{ animationDelay: "120ms" }}
          >
            {children}
          </div>
        </div>
      </div>
    </FillProvider>
  );
}
