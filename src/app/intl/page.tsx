import type { Metadata } from "next";
import { LandingView } from "@/components/landing/landing-view";
import { APP_NAME } from "@/lib/app-config";

// The English version of the home page for visitors outside India. The host serves it at "/" (see the rewrite in
// src/lib/supabase/middleware.ts); search engines should treat "/" as the one real address.
export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Split expenses, not friendships` },
  description: "Free expense splitting for groups and friends: offline mode, many currencies and smart settle-up. Available on the web and as an Android app — iOS coming soon.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default function InternationalLandingPage() {
  return <LandingView international />;
}
