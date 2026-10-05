"use client";

import { useId } from "react";
import { useFillLevel } from "@/components/auth/fill-context";
import { fillCaption, fillMood } from "@/lib/form-fill";
import { cn } from "@/lib/utils";

const TRAVEL = 172; // how far the water surface moves between empty and full (SVG units)

/**
 * A glass ghara (matka) that fills with water as the form beside it is filled in. Decorative; the caption is the
 * accessible status. Motion respects "reduce motion" (the level still changes, just without waves and drips).
 */
export function FillingPot({ size = "lg", className }: { size?: "lg" | "sm"; className?: string }) {
  const level = useFillLevel();
  const mood = fillMood(level);
  const uid = useId().replace(/:/g, "");
  const clip = `pot-clip-${uid}`;
  const water = `pot-water-${uid}`;
  const shine = `pot-shine-${uid}`;
  const glass = `pot-glass-${uid}`;
  const glow = `pot-glow-${uid}`;
  const clay = `pot-clay-${uid}`;
  const offset = (1 - level) * TRAVEL;
  const big = size === "lg";

  return (
    <figure
      data-testid={`filling-pot-${size}`}
      data-mood={mood}
      data-level={level}
      className={cn("flex flex-col items-center", className)}
    >
      <svg
        viewBox="0 0 200 250"
        className={cn("overflow-visible", big ? "h-[min(30vh,290px)] w-auto" : "w-20", mood === "full" && "fill-pop")}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clip}>
            <path d="M74 34 L126 34 C126 52 150 62 158 92 C170 134 160 188 138 208 C124 220 76 220 62 208 C40 188 30 134 42 92 C50 62 74 52 74 34 Z" />
          </clipPath>
          <linearGradient id={water} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a5f3fc" />
            <stop offset="0.5" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id={clay} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f59e6c" />
            <stop offset="1" stopColor="#c2562b" />
          </linearGradient>
          <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={shine} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* glow when full */}
        <ellipse cx="100" cy="222" rx="70" ry="12" fill="#000" opacity="0.18" />
        {mood === "full" && <circle cx="100" cy="130" r="92" className="fill-glow" fill="#67e8f9" opacity="0.18" />}

        {/* the glass body */}
        <path
          d="M74 34 L126 34 C126 52 150 62 158 92 C170 134 160 188 138 208 C124 220 76 220 62 208 C40 188 30 134 42 92 C50 62 74 52 74 34 Z"
          fill={`url(#${glass})`}
        />

        {/* the water, clipped to the body; the group slides up as the form fills */}
        <g clipPath={`url(#${clip})`}>
          <g style={{ transform: `translateY(${offset}px)`, transition: "transform 900ms cubic-bezier(.34,1.35,.5,1)" }} className="fill-level">
            <rect x="20" y="52" width="160" height="200" fill={`url(#${water})`} opacity="0.92" />
            <rect x="20" y="52" width="160" height="200" fill={`url(#${glow})`} />
            <path className="fill-wave-2" d="M-200 52 q25 -9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V70 H-200 Z" fill="#7dd3fc" opacity="0.55" />
            <path className="fill-wave" d="M-200 54 q25 9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V72 H-200 Z" fill="#bae6fd" opacity="0.8" />
            <path d="M-200 54 q25 9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" className="fill-wave" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" />
            {level > 0 && (
              <>
                <circle className="fill-bubble" cx="84" cy="200" r="3.5" fill="#fff" opacity="0.7" />
                <circle className="fill-bubble fill-bubble-2" cx="118" cy="190" r="2.5" fill="#fff" opacity="0.7" />
                <circle className="fill-bubble fill-bubble-3" cx="102" cy="205" r="3" fill="#fff" opacity="0.7" />
              </>
            )}
          </g>
        </g>

        {/* a light that glides across the glass now and then */}
        <g clipPath={`url(#${clip})`}>
          <g transform="skewX(-14)">
            <rect className="lg-sheen" x="20" y="30" width="22" height="200" fill="#fff" opacity="0.28" />
          </g>
        </g>

        {/* glass edge (thick wall) + specular highlights */}
        <path
          d="M74 34 L126 34 C126 52 150 62 158 92 C170 134 160 188 138 208 C124 220 76 220 62 208 C40 188 30 134 42 92 C50 62 74 52 74 34 Z"
          fill="none" stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="6" transform="translate(0 0)" style={{ mixBlendMode: "screen" }}
        />
        <path d="M150 112 C157 138 154 168 142 192" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="92" cy="26" rx="14" ry="2.2" fill="#fff" opacity="0.55" />
        <path
          d="M74 34 L126 34 C126 52 150 62 158 92 C170 134 160 188 138 208 C124 220 76 220 62 208 C40 188 30 134 42 92 C50 62 74 52 74 34 Z"
          fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.5"
        />
        <path d="M58 100 C50 130 54 170 70 196" fill="none" stroke={`url(#${shine})`} strokeWidth="7" strokeLinecap="round" />

        {/* clay rim, band and base */}
        <rect x="66" y="24" width="68" height="14" rx="7" fill={`url(#${clay})`} />
        <ellipse cx="100" cy="30" rx="26" ry="3.5" fill="#7c2d12" opacity="0.55" />
        <path d="M44 112 C70 122 130 122 156 112 L158 124 C130 134 70 134 42 124 Z" fill={`url(#${clay})`} opacity="0.95" />
        <circle cx="70" cy="123" r="2.2" fill="#fff" opacity="0.8" /><circle cx="100" cy="127" r="2.2" fill="#fff" opacity="0.8" /><circle cx="130" cy="123" r="2.2" fill="#fff" opacity="0.8" />
        <ellipse cx="100" cy="214" rx="40" ry="9" fill={`url(#${clay})`} />

        {/* drops falling in while the form is being filled */}
        {mood === "filling" && (
          <>
            <path className="fill-drip" d="M100 -6 C96 4 94 8 100 12 C106 8 104 4 100 -6 Z" fill="#7dd3fc" />
            <path className="fill-drip fill-drip-2" d="M92 -6 C89 2 88 5 92 8 C96 5 95 2 92 -6 Z" fill="#bae6fd" />
            <path className="fill-drip fill-drip-3" d="M110 -6 C107 2 106 5 110 8 C114 5 113 2 110 -6 Z" fill="#bae6fd" />
          </>
        )}

        {/* sparkles when it's full */}
        {mood === "full" && (
          <g fill="#fff">
            <path className="fill-sparkle" d="M28 54 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 Z" />
            <path className="fill-sparkle fill-sparkle-2" d="M168 70 l2.5 -8 l2.5 8 l8 2.5 l-8 2.5 l-2.5 8 l-2.5 -8 l-8 -2.5 Z" />
            <path className="fill-sparkle fill-sparkle-3" d="M150 20 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" />
          </g>
        )}
      </svg>

      {big && (
        <figcaption role="status" aria-live="polite" className="mt-3 text-center text-sm font-medium text-white/85" data-testid="fill-caption">
          {fillCaption(level)}
        </figcaption>
      )}
    </figure>
  );
}
