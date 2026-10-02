import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-config";
import { TryAgainButton } from "./try-again-button";

export const metadata: Metadata = { title: "You're offline" };

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-2xl gradient-brand flex items-center justify-center">
          <svg className="size-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 3l18 18M8.111 8.111A5.25 5.25 0 0116.5 12m-1.178 4.323A5.25 5.25 0 017.5 12M2.457 9.457A9.75 9.75 0 0121.543 14.543M12 20.25h.008v.008H12v-.008z" />
          </svg>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You&apos;re offline</h1>
          <p className="text-sm text-muted-foreground">
            No internet connection detected. Check your connection and try again.
            Pages you&apos;ve visited recently may still be available.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <TryAgainButton />
          <Link
            href="/dashboard"
            className="w-full h-11 rounded-xl border border-border flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
          >
            Go to dashboard
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">{APP_NAME}</p>
      </div>
    </div>
  );
}
