import { useId } from "react";
import { MARK } from "@/lib/brand-mark";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

/** The mark on its own (a coin split in two). Decorative unless `title` is given. */
export function BrandMark({ size = 36, title, className }: { size?: number; title?: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `bm-bg-${uid}`, gloss = `bm-gl-${uid}`, b = `bm-b-${uid}`;
  return (
    <svg
      viewBox={MARK.viewBox}
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0 drop-shadow-[0_6px_14px_rgba(76,29,149,0.35)]", className)}
      data-testid="brand-mark"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={MARK.colors.bg[0]} /><stop offset="0.5" stopColor={MARK.colors.bg[1]} /><stop offset="1" stopColor={MARK.colors.bg[2]} />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={b} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={MARK.colors.coinB[0]} /><stop offset="1" stopColor={MARK.colors.coinB[1]} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${bg})`} />
      <path d="M0 13A13 13 0 0 1 13 0H35A13 13 0 0 1 48 13V24H0Z" fill={`url(#${gloss})`} />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.5" />
      <g transform="translate(-3.6 -3.6) scale(1.15)">
        <path d={MARK.halfA} fill={MARK.colors.coinA} />
        <path d={MARK.halfB} fill={`url(#${b})`} transform={`translate(${MARK.gap} ${MARK.gap})`} />
      </g>
    </svg>
  );
}

/**
 * Mark + wordmark. `tone="light"` is for dark/colourful backgrounds (white text), `"dark"` for light ones.
 * The accessible name is always "Splitr Pro"; the visual split ("Splitr" + a PRO tag) is decorative.
 */
export function BrandLogo({ size = 36, tone = "dark", className }: { size?: number; tone?: "light" | "dark"; className?: string }) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} data-testid="brand-logo">
      <BrandMark size={size} />
      <span className="sr-only">{APP_NAME}</span>
      <span aria-hidden="true" className="flex items-baseline gap-1.5 leading-none" style={{ fontSize: Math.round(size * 0.52) }}>
        <span className={cn("font-extrabold tracking-[-0.03em]", light ? "text-white" : "text-foreground")}>Splitr</span>
        <span
          className={cn(
            "rounded-md px-1.5 py-[3px] font-bold uppercase tracking-[0.12em]",
            light ? "bg-white/20 text-white ring-1 ring-white/30" : "bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300"
          )}
          style={{ fontSize: "0.56em" }}
        >
          Pro
        </span>
      </span>
    </span>
  );
}
