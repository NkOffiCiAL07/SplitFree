import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { BrandLogo } from "@/components/shared/brand-logo";
import { FillProvider } from "@/components/auth/fill-context";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { RegionProvider } from "@/components/auth/region-context";
import { regionFor } from "@/lib/region";

export const metadata: Metadata = {
  title: "Sign in",
};

// The phone's status bar takes the page colour (light or dark), so there is no strip above the form
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#090a0f" },
  ],
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

  return (
    <RegionProvider region={region}>
    <FillProvider>
      <div className="auth-calm relative isolate flex min-h-dvh flex-col overflow-x-clip bg-[#f7f8fc] dark:bg-[#090a0f]">
        <div
          aria-hidden="true"
          data-testid="calm-glow"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(55%_65%_at_50%_0%,rgba(91,92,226,0.10),transparent_70%)] dark:bg-[radial-gradient(55%_65%_at_50%_0%,rgba(99,91,255,0.20),transparent_70%)]"
        />

        {/* Soft coloured light behind the card, so the glass has something to pick up (desktop only: phones have no card) */}
        <div aria-hidden="true" data-testid="calm-light" className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
          <div className="absolute -left-24 top-1/3 size-[26rem] rounded-full bg-indigo-400/10 blur-[110px] dark:bg-indigo-500/20" />
          <div className="absolute -right-20 top-1/2 size-[24rem] rounded-full bg-violet-400/10 blur-[110px] dark:bg-violet-500/20" />
          <div className="absolute bottom-0 left-1/3 size-[22rem] rounded-full bg-sky-300/10 blur-[110px] dark:bg-sky-500/15" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
          <Link href="/" aria-label="Splitr Pro home" className="rounded-md">
            <BrandLogo size={28} />
          </Link>
          <Link href="/" data-hide-in-app className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Back to home
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:pt-8 lg:px-4 lg:pb-12 lg:pt-4">
          <div
            data-testid="auth-card"
            className="auth-card flex w-full max-w-md flex-1 flex-col lg:max-w-[28rem] lg:flex-none lg:min-h-[53rem] lg:rounded-2xl lg:border lg:border-white/70 lg:bg-white/75 lg:p-8 lg:backdrop-blur-[28px] lg:backdrop-saturate-[140%] lg:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-24px_rgba(15,23,42,0.22)] dark:lg:border-white/10 dark:lg:bg-[#11131b]/75 dark:lg:shadow-[0_24px_70px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <Suspense fallback={null}>
              <AuthTabs />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </FillProvider>
    </RegionProvider>
  );
}
