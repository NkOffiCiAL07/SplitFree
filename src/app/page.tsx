import type { Metadata } from "next";
import { LandingView } from "@/components/landing/landing-view";
import { APP_NAME } from "@/lib/app-config";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Split expenses, not friendships` },
  description: "Free expense splitting for groups and friends, built for India: UPI, offline mode and smart settle-up. Available on the web and as an Android app — iOS coming soon.",
};

export default function LandingPage() {
  return <LandingView />;
}
