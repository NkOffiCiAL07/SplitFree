/**
 * The Splitr Pro mark: a coin cut in two halves with a small gap — "split". One drawing, used for the in-app logo,
 * the home-screen/PWA icons (scripts/generate-icons.mjs) and the iPhone launch screen, so they always match.
 * Coordinates are in a 48×48 box; the coin is centred and the cut runs along x + y = 48.
 */
export const MARK = {
  viewBox: "0 0 48 48",
  /** upper-left half: white */
  halfA: "M33.19 14.81 A13 13 0 0 0 14.81 33.19 Z",
  /** lower-right half: shifted by (2.2, 2.2) to open the gap, cool cyan */
  halfB: "M33.19 14.81 A13 13 0 0 1 14.81 33.19 Z",
  gap: 2.2,
  colors: {
    bg: ["#a78bfa", "#7c3aed", "#4338ca"] as const,
    coinA: "#ffffff",
    coinB: ["#cffafe", "#67e8f9"] as const,
  },
} as const;

/**
 * Standalone SVG string of the mark.
 *  - `rounded`: a squircle tile with a glossy top (in-app logo)
 *  - `bleed`: the gradient fills the whole square and the coin sits in the safe zone (maskable/PWA icons, which the OS rounds)
 */
export function brandMarkSvg(opts: { size?: number; variant?: "rounded" | "bleed" } = {}): string {
  const { size = 48, variant = "rounded" } = opts;
  const rx = variant === "rounded" ? 13 : 0;
  const scale = variant === "bleed" ? 1.2 : 1.15; // bigger than the raw drawing so it reads at small sizes (icons stay inside the maskable safe zone)
  const t = 24 - 24 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK.viewBox}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MARK.colors.bg[0]}"/><stop offset="0.5" stop-color="${MARK.colors.bg[1]}"/><stop offset="1" stop-color="${MARK.colors.bg[2]}"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MARK.colors.coinB[0]}"/><stop offset="1" stop-color="${MARK.colors.coinB[1]}"/></linearGradient>
</defs>
<rect width="48" height="48" rx="${rx}" fill="url(#bg)"/>
${variant === "rounded" ? `<path d="M0 13A13 13 0 0 1 13 0H35A13 13 0 0 1 48 13V24H0Z" fill="url(#gloss)"/>` : ""}
<g transform="translate(${t} ${t}) scale(${scale})">
<path d="${MARK.halfA}" fill="${MARK.colors.coinA}"/>
<path d="${MARK.halfB}" fill="url(#b)" transform="translate(${MARK.gap} ${MARK.gap})"/>
</g>
</svg>`;
}
