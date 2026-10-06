"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonitorSmartphone, X } from "lucide-react";

/** A slim pill that slides up after the visitor has scrolled a little: one account on web, Android and (soon) iPhone. */
export function ContinuityPill() {
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight;
      const nearEnd = total > window.innerHeight * 2 && window.scrollY + window.innerHeight > total - 900; // the closing section and footer have their own actions
      setShown(window.scrollY > 700 && !nearEnd);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (closed) return null;
  return (
    <div
      data-testid="continuity-pill"
      aria-hidden={!shown}
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-full border border-white/15 bg-slate-900/90 py-2 pl-4 pr-2 text-white shadow-2xl shadow-black/30 transition-all duration-500 ${shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
    >
      <MonitorSmartphone className="size-4 shrink-0 text-violet-300" />
      <p className="min-w-0 flex-1 text-xs leading-snug text-white/85 sm:text-sm">
        <span className="font-semibold text-white">Web, Android, iOS soon</span><span className="max-sm:hidden"> — synced everywhere.</span>
      </p>
      <Link href="/login" tabIndex={shown ? 0 : -1} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition-transform hover:scale-105 sm:text-sm">Launch web app</Link>
      <button type="button" tabIndex={shown ? 0 : -1} aria-label="Dismiss" onClick={() => setClosed(true)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><X className="size-3.5" /></button>
    </div>
  );
}
