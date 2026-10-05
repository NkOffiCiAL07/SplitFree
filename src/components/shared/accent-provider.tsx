"use client";

import { useSyncExternalStore } from "react";
import { ACCENT_KEY, DEFAULT_ACCENT, OLED_KEY, accentById, type Accent } from "@/lib/themes";

// The page's <html> tag IS the store: data-accent / data-oled are set before first paint by a tiny inline script, and
// here when someone chooses. Components subscribe to those attributes, so nothing can disagree with what is on screen.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const readAccent = () => (typeof document === "undefined" ? DEFAULT_ACCENT : accentById(document.documentElement.getAttribute("data-accent")).id);
const readOled = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-oled");

export function setAccent(id: string) {
  const accent = accentById(id).id;
  document.documentElement.setAttribute("data-accent", accent);
  try { localStorage.setItem(ACCENT_KEY, accent); } catch { /* private mode: it still applies for this visit */ }
  notify();
}

export function setOled(on: boolean) {
  if (on) document.documentElement.setAttribute("data-oled", "");
  else document.documentElement.removeAttribute("data-oled");
  try { localStorage.setItem(OLED_KEY, on ? "1" : "0"); } catch { /* see above */ }
  notify();
}

/** The chosen colour theme (and its colours, for places that can't use CSS variables, like charts). */
export function useAccent(): Accent {
  return accentById(useSyncExternalStore(subscribe, readAccent, () => DEFAULT_ACCENT));
}

/** "Pure black" for dark mode (OLED screens). */
export function useOled(): boolean {
  return useSyncExternalStore(subscribe, readOled, () => false);
}
