import { Download } from "lucide-react";
import { AppleLogo } from "@/components/shared/apple-logo";
import { ANDROID_APP, androidSizeLabel } from "@/lib/android-app";
import { cn } from "@/lib/utils";

function AndroidGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 10-.66-.38l-1.86 3.2a11.5 11.5 0 00-9.84 0L5.22 5.92a.38.38 0 10-.66.38l1.84 3.18A10.8 10.8 0 001 18h22a10.8 10.8 0 00-5.4-8.52zM7 15.25a1.12 1.12 0 110-2.25 1.12 1.12 0 010 2.25zm10 0a1.12 1.12 0 110-2.25 1.12 1.12 0 010 2.25z" />
    </svg>
  );
}

/** Direct, signed APK download. A plain link, so it works with no JavaScript. */
export function AndroidDownloadButton({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <a
      href={ANDROID_APP.path}
      download={ANDROID_APP.fileName}
      data-testid="android-download"
      className={cn(
        "group inline-flex items-center gap-3 rounded-2xl px-5 py-2.5 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2",
        tone === "dark" ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" : "bg-white text-zinc-900 hover:bg-white/90",
        className
      )}
    >
      <AndroidGlyph className="size-7 shrink-0 text-emerald-400 dark:text-emerald-600" />
      <span className="leading-tight">
        <span className="block text-[10px] font-medium uppercase tracking-wider opacity-70">Download for</span>
        <span className="block text-base font-semibold">Android</span>
      </span>
      <Download className="ml-1 size-4 opacity-60 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
      <span className="sr-only">APK, {androidSizeLabel}</span>
    </a>
  );
}

/** iOS isn't available yet — shown honestly as "coming soon" (not a link, so nothing can be tapped by mistake). */
export function IosComingSoon({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div
      data-testid="ios-coming-soon"
      aria-label="iOS app coming soon"
      className={cn(
        "relative inline-flex cursor-default items-center gap-3 rounded-2xl border px-5 py-2.5 text-left",
        tone === "dark" ? "border-border bg-card/60 text-muted-foreground" : "border-white/30 bg-white/10 text-white/80",
        className
      )}
    >
      <AppleLogo className="size-7 shrink-0 opacity-70" aria-hidden="true" />
      <span className="leading-tight">
        <span className="block text-[10px] font-medium uppercase tracking-wider opacity-70">iPhone &amp; iPad</span>
        <span className="block text-base font-semibold">Coming soon</span>
      </span>
      <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow">SOON</span>
    </div>
  );
}
