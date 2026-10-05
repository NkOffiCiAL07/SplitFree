"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROWS = [
  { icon: "✓", tone: "bg-emerald-400/90 text-emerald-950", text: <><b className="font-semibold">Asha</b> paid you ₹850</>, meta: "Just now" },
  { icon: "🏖️", tone: "bg-sky-300/90 text-sky-950", text: <>Goa trip — <b className="font-semibold">all settled</b></>, meta: "4 friends" },
  { icon: "⚡", tone: "bg-amber-300/90 text-amber-950", text: <>10 payments → <b className="font-semibold">3</b></>, meta: "Simplified" },
];

/** A little live "activity" card (decoration): the highlight walks down the rows so the page feels alive. */
export function ActivityFeed({ className }: { className?: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % ROWS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div aria-hidden="true" data-testid="activity-feed" className={cn("lg-glass-dark w-[272px] rounded-3xl p-2.5 text-xs text-white", className)}>
      <div className="mb-2 flex items-center gap-1.5 px-2 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
        </span>
        Live activity
      </div>
      <ul className="space-y-1">
        {ROWS.map((r, i) => (
          <li
            key={i}
            data-active={i === active}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl px-2 py-2 transition-all duration-500",
              i === active ? "scale-100 bg-white/15 opacity-100" : "scale-[0.97] opacity-55",
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[13px]", r.tone)}>{r.icon}</span>
            <span className="min-w-0 flex-1 truncate">{r.text}</span>
            <span className="shrink-0 text-[10px] text-white/60">{r.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
