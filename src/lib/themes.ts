/**
 * Colour themes for the signed-in app. Every palette is a 10-step scale (like Tailwind's) plus the two colours its
 * buttons use in light and dark mode; they are applied through CSS variables (`<html data-accent="ocean">`), so the whole
 * app recolours at once. Red and green are deliberately NOT offered: they mean "you owe" and "you're owed".
 */
export type Step = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
const STEPS: Step[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export interface Accent {
  id: string;
  name: string;
  scale: Record<Step, string>;
  /** second colour of the brand gradient (buttons, logo tile) */
  gradientTo: string;
  /** button colour in light mode (white text on it: contrast ≥ 4.5) and in dark mode (dark text on it) */
  primaryLight: string;
  primaryDark: string;
}

const scale = (...hex: string[]): Record<Step, string> => Object.fromEntries(STEPS.map((s, i) => [s, hex[i]])) as Record<Step, string>;

export const ACCENTS: Accent[] = [
  {
    id: "violet", name: "Violet",
    scale: scale("#f5f4ff", "#ebe9ff", "#d9d6ff", "#bdb8ff", "#9b94ff", "#7c72ff", "#635bff", "#4f48e6", "#3f39c2", "#2f2b8f"),
    gradientTo: "#746eff", primaryLight: "#635bff", primaryDark: "#8b83ff",
  },
  {
    id: "ocean", name: "Ocean",
    scale: scale("#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"),
    gradientTo: "#0891b2", primaryLight: "#2563eb", primaryDark: "#60a5fa",
  },
  {
    id: "teal", name: "Teal",
    scale: scale("#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a"),
    gradientTo: "#0891b2", primaryLight: "#0f766e", primaryDark: "#2dd4bf",
  },
  {
    id: "sunset", name: "Sunset",
    scale: scale("#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12"),
    gradientTo: "#d97706", primaryLight: "#c2410c", primaryDark: "#fb923c",
  },
  {
    id: "pink", name: "Pink",
    scale: scale("#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843"),
    gradientTo: "#7c3aed", primaryLight: "#be185d", primaryDark: "#f472b6",
  },
  {
    id: "graphite", name: "Graphite",
    scale: scale("#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a"),
    gradientTo: "#1e293b", primaryLight: "#475569", primaryDark: "#cbd5e1",
  },
];

export const DEFAULT_ACCENT = "violet";
export const ACCENT_KEY = "splitr-accent";
export const OLED_KEY = "splitr-oled";

export const accentById = (id: string | null | undefined): Accent => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

/** "#7c3aed" → "262 83% 58%" (the form the app's colour variables use) */
export function hexToHsl(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** The CSS variables of one palette. */
function variables(a: Accent): string {
  const brand = STEPS.map((s) => `--brand-${s}:${hexToHsl(a.scale[s])};`).join("");
  return `${brand}--brand-grad-a:${hexToHsl(a.scale[600])};--brand-grad-b:${hexToHsl(a.gradientTo)};--primary:${hexToHsl(a.primaryLight)};--ring:${hexToHsl(a.primaryLight)};`;
}

/** CSS for every palette except the default (which lives in globals.css, so the app is correctly coloured without scripts). */
export function accentCss(): string {
  return ACCENTS.filter((a) => a.id !== DEFAULT_ACCENT)
    .map((a) => `:root[data-accent="${a.id}"]{${variables(a)}}:root[data-accent="${a.id}"].dark{--primary:${hexToHsl(a.primaryDark)};--ring:${hexToHsl(a.primaryDark)};}`)
    .join("");
}

/** The default palette's variables, for globals.css (kept in a test so the two can never drift apart). */
export const defaultVariables = () => variables(ACCENTS[0]);

/** Runs before the page paints: applies the saved palette and "pure black", so there is no flash of the wrong colours. */
export const accentBootScript = `try{var d=document.documentElement,a=localStorage.getItem("${ACCENT_KEY}");if(a&&/^[a-z]+$/.test(a))d.setAttribute("data-accent",a);if(localStorage.getItem("${OLED_KEY}")==="1")d.setAttribute("data-oled","")}catch(e){}`;

// ── relative luminance / contrast (WCAG), used by tests and by anything that must keep text readable ──
const channel = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
