import { Suspense } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import type { Metadata, Viewport } from "next";
import { Check } from "lucide-react";
import { FillProvider } from "@/components/auth/fill-context";
import { FillingPot } from "@/components/auth/filling-pot";
import { ActivityFeed } from "@/components/auth/activity-feed";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { RotatingWords } from "@/components/landing/rotating-words";
import { HEADLINE_LINE_1, HEADLINE_LINE_2, SUBLINE, OCCASIONS } from "@/lib/brand-copy";

export const metadata: Metadata = {
  title: "Sign in",
};

// The phone status bar takes the canvas colour at the top (no white strip above the dark header)
export const viewport: Viewport = {
  themeColor: "#120b34",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const TRUST = ["Free forever", "No ads", "Works offline"];

// Scrolling proof-of-life strip on phones (decorative)
const CHIPS = ["✅ Asha settled ₹850 on UPI", "🏖️ Goa trip squared up", "🍕 Dinner split 4 ways", "⚡ Fewer payments, same result", "🏠 Rent split, no awkward chats", "📲 Pay in one tap"];

const FADE_EDGES = "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)";

// ₹ coins that float up around the chip strip (left %, size px, delay s, duration s)
const COINS: [number, number, number, number][] = [[6, 18, 0, 9], [22, 14, 2.5, 11], [38, 20, 5, 10], [54, 13, 1.2, 12], [68, 17, 4, 9.5], [83, 15, 7, 11], [93, 19, 3.2, 10.5]];

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="lg-blob -left-24 top-8 h-[420px] w-[420px] bg-cyan-400/40" />
      <div className="lg-blob lg-blob-2 -right-20 top-1/3 h-[460px] w-[460px] bg-fuchsia-500/35" />
      <div className="lg-blob lg-blob-3 bottom-[-120px] left-1/4 h-[400px] w-[400px] bg-indigo-400/40" />
      <div className="lg-blob lg-blob-2 right-1/4 top-[-90px] h-[260px] w-[260px] bg-violet-400/30" />
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <FillProvider>
      {/* One canvas for everything: hero and form float on the same aurora (no hard split between two halves) */}
      <div className="auth-canvas relative isolate min-h-dvh overflow-hidden">
        <Backdrop />
        <div aria-hidden="true" className="auth-dots pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="auth-grain pointer-events-none absolute inset-0" />

        <div className="relative z-10 flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Left — hero (desktop) */}
          <div className="hidden min-h-dvh flex-col justify-between p-10 lg:flex xl:p-14">
            <div className="anim-fade-up">
              <BrandLogo size={48} tone="light" />
            </div>

            {/* The glass pot fills as the form is filled in, on a softly lit stage; a live activity card sits beside it */}
            <div className="flex flex-1 flex-col items-center justify-center gap-5 py-3 xl:flex-row xl:gap-10">
              <div className="relative">
                <div aria-hidden="true" className="auth-orb pointer-events-none absolute left-1/2 top-[46%] -z-10 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2" />
                <FillingPot size="lg" />
              </div>
              <ActivityFeed className="anim-fade-up max-xl:[@media(max-height:820px)]:hidden [@media(max-height:700px)]:hidden" />
            </div>

            <div className="relative z-10 space-y-4 text-white">
              <h2 className="anim-fade-up text-4xl font-bold leading-[1.05] tracking-tight xl:text-6xl [@media(max-height:960px)]:xl:text-5xl" style={{ animationDelay: "80ms" }}>
                {HEADLINE_LINE_1}
                <span className="lg-text-shimmer block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">{HEADLINE_LINE_2}</span>
              </h2>
              <p className="anim-fade-up max-w-md text-sm leading-relaxed text-white/80 xl:text-lg [@media(max-height:960px)]:xl:text-base" style={{ animationDelay: "160ms" }}>
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
              on desktop: the form card with a light running around its edge */}
          <div className="flex flex-1 flex-col items-center justify-start lg:justify-center lg:p-8">
            {/* Phone header: compact, so the form is visible straight away (also what the Android app shows signed out) */}
            <section
              aria-label="Welcome"
              data-testid="welcome"
              className="relative z-10 w-full px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white lg:hidden [@media(min-height:800px)]:pb-8 [@media(min-height:800px)]:pt-[max(2.5rem,env(safe-area-inset-top))]"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                {COINS.map(([left, size, delay, dur]) => (
                  <span key={left} className="lg-coin" style={{ left: `${left}%`, width: size, height: size, fontSize: size * 0.6, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}>₹</span>
                ))}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <BrandLogo size={38} tone="light" className="mb-3" />
                  <p className="text-[1.65rem] font-bold leading-[1.1] tracking-tight">
                    {HEADLINE_LINE_1}{" "}
                    <span className="lg-text-shimmer block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">{HEADLINE_LINE_2}</span>
                  </p>
                </div>
                <FillingPot size="sm" className="shrink-0 scale-110" />
              </div>
              <p className="mt-2 hidden text-sm leading-relaxed text-white/80 min-[400px]:[@media(min-height:780px)]:block">{SUBLINE}</p>
              <p className="mt-2 text-xs text-white/80 [@media(max-height:640px)]:hidden">
                Made for <RotatingWords words={OCCASIONS} className="font-semibold text-white" />
              </p>
              <div aria-hidden="true" data-testid="chip-strip" className="-mx-6 mt-3 overflow-hidden [@media(max-height:690px)]:hidden" style={{ WebkitMaskImage: FADE_EDGES, maskImage: FADE_EDGES }}>
                <div className="lg-marquee flex w-max">
                  {[...CHIPS, ...CHIPS].map((c, i) => (
                    <span key={i} className="lg-glass-dark mr-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium">{c}</span>
                  ))}
                </div>
              </div>
            </section>

            <div className="relative z-10 flex w-full flex-1 flex-col lg:max-w-[28rem] lg:flex-none lg:overflow-hidden lg:rounded-3xl lg:p-px lg:shadow-[0_40px_90px_-25px_rgba(76,29,149,0.85)]">
              <span aria-hidden="true" className="auth-card-glow pointer-events-none absolute inset-0 hidden lg:block" />
              <div
                className="lg-glass anim-fade-up relative z-10 flex w-full flex-1 flex-col rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 max-lg:border-0 max-lg:bg-background! max-lg:bg-none! max-lg:backdrop-filter-none! max-lg:shadow-[0_-18px_50px_-18px_rgba(30,10,80,0.5)]! lg:rounded-[calc(1.5rem-1px)] lg:border-0 lg:bg-background! lg:bg-none! lg:p-9 lg:backdrop-filter-none! lg:shadow-none!"
                style={{ animationDelay: "120ms" }}
              >
                <Suspense fallback={null}>
                  <AuthTabs />
                </Suspense>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FillProvider>
  );
}
