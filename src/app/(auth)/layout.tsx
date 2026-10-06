import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { BrandLogo } from "@/components/shared/brand-logo";
import { FillProvider } from "@/components/auth/fill-context";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { RegionProvider } from "@/components/auth/region-context";
import { regionFor } from "@/lib/region";
import { brandCopy } from "@/lib/brand-copy";
import { AuthShowcase, AuthMobileHero, type ShowcaseData } from "@/components/auth/auth-showcase";
import { AuthStage } from "@/components/auth/auth-stage";

const SHOWCASE_IN = { trip: { name: "Goa \u201926", emoji: "🏝️", total: "₹18,450", people: 4, youGet: "₹2,840" }, dinner: { name: "Dinner", emoji: "🍕", owe: "₹640" }, kicker: "No more “bhai, paise kab doge?” 😌" };
const SHOWCASE_INTL = { trip: { name: "Lisbon \u201926", emoji: "🏝️", total: "$920", people: 4, youGet: "$140" }, dinner: { name: "Dinner", emoji: "🍕", owe: "$32" }, kicker: "No more awkward “so… when are you paying me back?” 😌" };


export const metadata: Metadata = {
  title: "Sign in",
};

// The phone's status bar takes the page colour (light or dark), so there is no strip above the form
export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Sign in / create account: a calm, trustworthy page. Almost white, one soft indigo glow, a small logo, then the form.
 * On a phone there is no card at all, just the form on the page; on a desktop it sits on one readable glass card (about 75% opaque) over soft light.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // The visitor's country sets the phone-number default; the host adds this header
  const region = regionFor((await headers()).get("x-vercel-ip-country"));
  const copy = brandCopy(region);
  const showcase: ShowcaseData = { ...(region.isIndia ? SHOWCASE_IN : SHOWCASE_INTL), line1: copy.line1, line2: copy.line2, before: 10, after: 3 };

  return (
    <RegionProvider region={region}>
    <FillProvider>
      <AuthStage className="auth-calm dark relative isolate min-h-dvh overflow-x-clip bg-[#08090d] text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
        <AuthShowcase d={showcase} />
        <div className="relative isolate flex min-h-dvh flex-col">
        <div
          aria-hidden="true"
          data-testid="calm-glow"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(55%_65%_at_50%_0%,rgba(99,91,255,0.18),transparent_70%)]"
        />

        {/* Soft coloured light behind the card, so the glass has something to pick up (desktop only: phones have no card) */}
        <div aria-hidden="true" data-testid="calm-light" className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
          <div className="absolute -left-24 top-1/3 size-[26rem] rounded-full bg-indigo-500/15 blur-[110px]" />
          <div className="absolute -right-20 top-1/2 size-[24rem] rounded-full bg-violet-500/15 blur-[110px]" />
          <div className="absolute bottom-0 left-1/3 size-[22rem] rounded-full bg-cyan-400/10 blur-[110px]" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between max-lg:justify-between lg:justify-end px-6 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
          <Link href="/" aria-label="Splitr Pro home" className="rounded-md lg:hidden">
            <BrandLogo size={28} tone="light" />
          </Link>
          <Link href="/" data-hide-in-app className="text-sm text-[#a1a7b5] transition-colors hover:text-white">
            ← Back to home
          </Link>
        </header>

        <AuthMobileHero d={showcase} />

        <main className="flex flex-1 flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:pt-8 lg:px-4 lg:pb-12 lg:pt-4">
          <div
            data-testid="auth-card"
            className="auth-card flex w-full max-w-md flex-1 flex-col lg:max-w-[27.5rem] lg:flex-none lg:min-h-[53rem] lg:rounded-2xl lg:border lg:border-white/10 lg:bg-white/[0.055] lg:p-10 lg:backdrop-blur-[30px] lg:backdrop-saturate-[150%] lg:shadow-[0_25px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.07)]"
          >
            <Suspense fallback={null}>
              <AuthTabs />
            </Suspense>
            {children}
          </div>
        </main>
        </div>
      </AuthStage>
    </FillProvider>
    </RegionProvider>
  );
}
