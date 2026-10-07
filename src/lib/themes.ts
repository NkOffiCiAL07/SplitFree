/**
 * Themes for the signed-in app. Every theme is a 10-step colour scale (like Tailwind's) plus the two colours its buttons
 * use in light and dark mode. They are applied through CSS variables (`<html data-accent="ocean">`), and every theme
 * except the default also tints the page itself (background, cards, borders, menus), so the whole app changes at once.
 * Red and green are deliberately NOT offered: they mean "you owe" and "you're owed".
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
  /** how strongly the page surfaces are tinted with the theme's colour (1 = normal, lower = subtler); the default theme has none */
  tint?: number;
}

const scale = (...hex: string[]): Record<Step, string> => Object.fromEntries(STEPS.map((s, i) => [s, hex[i]])) as Record<Step, string>;

export const ACCENTS: Accent[] = [
  {
    id: "violet", name: "Violet",
    scale: scale("#f5f4ff", "#ebe9ff", "#d9d6ff", "#bdb8ff", "#9b94ff", "#7c72ff", "#635bff", "#4f48e6", "#3f39c2", "#2f2b8f"),
    gradientTo: "#746eff", primaryLight: "#5148f0", primaryDark: "#8b83ff",
  },
  {
    id: "ocean", name: "Ocean",
    scale: scale("#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"),
    gradientTo: "#0891b2", primaryLight: "#1d4ed8", primaryDark: "#60a5fa",
  },
  {
    id: "teal", name: "Teal",
    scale: scale("#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a"),
    gradientTo: "#0891b2", primaryLight: "#0f766e", primaryDark: "#2dd4bf",
  },
  {
    id: "sunset", name: "Sunset",
    scale: scale("#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12"),
    gradientTo: "#d97706", primaryLight: "#b83a0b", primaryDark: "#fb923c",
  },
  {
    id: "pink", name: "Pink",
    scale: scale("#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843"),
    gradientTo: "#7c3aed", primaryLight: "#be185d", primaryDark: "#f472b6",
  },
  {
    id: "graphite", name: "Graphite",
    scale: scale("#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a"),
    gradientTo: "#1e293b", primaryLight: "#475569", primaryDark: "#cbd5e1", tint: 0.4,
  },
  {
    id: "sky", name: "Sky",
    scale: scale("#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e"),
    gradientTo: "#6366f1", primaryLight: "#0369a1", primaryDark: "#38bdf8",
  },
  {
    id: "indigo", name: "Indigo",
    scale: scale("#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81"),
    gradientTo: "#7c3aed", primaryLight: "#4338ca", primaryDark: "#818cf8",
  },
  {
    id: "orchid", name: "Orchid",
    scale: scale("#fdf4ff", "#fae8ff", "#f5d0fe", "#f0abfc", "#e879f9", "#d946ef", "#c026d3", "#a21caf", "#86198f", "#701a75"),
    gradientTo: "#7c3aed", primaryLight: "#a21caf", primaryDark: "#e879f9",
  },
  {
    id: "amber", name: "Amber",
    scale: scale("#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"),
    gradientTo: "#ea580c", primaryLight: "#a8480a", primaryDark: "#fbbf24", tint: 0.9,
  },
  {
    id: "coffee", name: "Coffee",
    scale: scale("#fbf7f3", "#f3e9df", "#e6d2bd", "#d4b596", "#bf9468", "#a8764a", "#8b5e3c", "#6f4a2f", "#563a26", "#3e2a1b"),
    gradientTo: "#6f4a2f", primaryLight: "#8b5e3c", primaryDark: "#d4b596", tint: 0.8,
  },
  {
    id: "midnight", name: "Midnight",
    scale: scale("#f1f5fd", "#e1e9fb", "#c3d3f6", "#97b0ec", "#6a89de", "#4a68c8", "#3a52a8", "#2f4287", "#263468", "#1b2548"),
    gradientTo: "#1b2548", primaryLight: "#3a52a8", primaryDark: "#97b0ec", tint: 1.1,
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

const hueOf = (a: Accent) => hexToHsl(a.scale[600]).split(" ")[0];
const sat = (a: Accent, base: number) => `${Math.round(base * (a.tint ?? 1))}%`;

/** The page itself in this theme's tint, light mode: background, muted areas, borders and text (cards stay white). */
function lightSurfaces(a: Accent): string {
  const h = hueOf(a);
  return `--background:${h} ${sat(a, 40)} 97%;--foreground:${h} 28% 9%;--muted:${h} ${sat(a, 38)} 94%;--secondary:${h} ${sat(a, 38)} 94%;--accent:${h} ${sat(a, 38)} 94%;--muted-foreground:${h} 12% 38%;--border:${h} ${sat(a, 30)} 89%;--input:${h} ${sat(a, 30)} 87%;`;
}

/** The same in dark mode (a deep, tinted near-black). */
function darkSurfaces(a: Accent): string {
  const h = hueOf(a);
  return `--background:${h} ${sat(a, 28)} 5%;--card:${h} ${sat(a, 26)} 8%;--popover:${h} ${sat(a, 26)} 8%;--muted:${h} ${sat(a, 22)} 13%;--secondary:${h} ${sat(a, 22)} 13%;--accent:${h} ${sat(a, 22)} 15%;--border:${h} ${sat(a, 20)} 19%;--input:${h} ${sat(a, 20)} 19%;--foreground:${h} 25% 97%;--muted-foreground:${h} 10% 66%;`;
}

/** "Pure black" must still win over a theme's dark tint (it is meant for OLED screens), so it is restated for each theme. */
const OLED_SURFACES = "--background:0 0% 0%;--card:0 0% 5%;--popover:0 0% 5%;--muted:0 0% 11%;--secondary:0 0% 11%;--accent:0 0% 13%;--border:0 0% 15%;--input:0 0% 15%;";

/** CSS for every theme except the default (which lives in globals.css, so the app is correctly coloured without scripts). */
export function accentCss(): string {
  return ACCENTS.filter((a) => a.id !== DEFAULT_ACCENT)
    .map((a) => {
      const sel = `:root[data-accent="${a.id}"]`;
      return `${sel}{${variables(a)}${lightSurfaces(a)}}${sel}.dark{--primary:${hexToHsl(a.primaryDark)};--ring:${hexToHsl(a.primaryDark)};${darkSurfaces(a)}}${sel}.dark[data-oled]{${OLED_SURFACES}}`;
    })
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
