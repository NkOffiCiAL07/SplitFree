import { isValidPhone } from "@/lib/phone";

/**
 * How "full" a sign-in / sign-up form is, from 0 to 1 — drives the water level in the filling-pot animation.
 * Each field contributes equally; a field fills gradually while typed and completes when its value is valid enough.
 */
export type FillField =
  | { kind: "name"; value: string | undefined }
  | { kind: "email"; value: string | undefined }
  | { kind: "phone"; value: string | undefined }
  | { kind: "password"; value: string | undefined; min?: number };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function fieldScore(f: FillField): number {
  const v = f.value ?? "";
  if (f.kind === "email") return EMAIL.test(v.trim()) ? 1 : clamp(v.trim().length / 16) * 0.85; // never "full" until it's a real address
  if (f.kind === "phone") return isValidPhone(v) ? 1 : clamp(v.replace(/\D/g, "").length / 10) * 0.85; // never "full" until it is a real number
  if (f.kind === "name") return clamp(v.trim().length / 2);
  return clamp(v.length / (f.min ?? 8));
}

export function formProgress(fields: FillField[]): number {
  if (fields.length === 0) return 0;
  const sum = fields.reduce((s, f) => s + fieldScore(f), 0);
  return Math.round((sum / fields.length) * 1000) / 1000;
}

export type FillMood = "empty" | "filling" | "full";
export const fillMood = (level: number): FillMood => (level >= 1 ? "full" : level > 0 ? "filling" : "empty");

export const fillCaption = (level: number) =>
  fillMood(level) === "full" ? "Full! You're ready 🎉" : fillMood(level) === "filling" ? "Keep going — the water's rising…" : "Start typing and watch it fill 💧";
