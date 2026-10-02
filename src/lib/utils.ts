import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const _fmtCache = new Map<string, Intl.NumberFormat>();

function _fmt(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}-${currency}`;
  let f = _fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    _fmtCache.set(key, f);
  }
  return f;
}

/** Indian digit grouping (₹10,00,000.00) for rupees; US grouping for everything else. */
function localeFor(currency: string) {
  return currency === "INR" ? "en-IN" : "en-US";
}

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale = localeFor(currency)
): string {
  return _fmt(currency, locale).format(amount / 100); // amounts stored in cents
}

const _symbolCache = new Map<string, string>();

/**
 * Compact currency for tight UI spaces (stat cards on mobile).
 * INR: ₹10,100 → ₹10.1K  |  ₹1,50,000 → ₹1.5L  |  ₹2,50,00,000 → ₹2.5Cr  |  USD: $1.5M
 */
export function formatCompactCurrency(cents: number, currency: string = DEFAULT_CURRENCY): string {
  const abs = Math.abs(cents) / 100;
  const sign = cents < 0 ? "−" : "";
  let symbol = _symbolCache.get(currency);
  if (!symbol) {
    symbol = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 })
      .format(0)
      .replace(/[\d,.\s]/g, "")
      .trim();
    _symbolCache.set(currency, symbol);
  }

  // Rupees read in lakh/crore (₹1.5L, ₹2.3Cr); everything else in K/M/B
  const tiers: [number, string][] =
    currency === "INR"
      ? [[1_00_00_000, "Cr"], [1_00_000, "L"], [1_000, "K"]]
      : [[1_000_000_000, "B"], [1_000_000, "M"], [1_000, "K"]];
  for (const [size, suffix] of tiers) {
    if (abs >= size) return `${sign}${symbol}${(abs / size).toFixed(1)}${suffix}`;
  }
  return `${sign}${formatCurrency(Math.abs(cents), currency)}`;
}

/** Short money label for chart axes: ₹0, ₹500, ₹10K, ₹1.5L (never wider than the axis can show). */
export function formatAxisCurrency(major: number, currency: string = DEFAULT_CURRENCY): string {
  if (major === 0) return "0";
  return formatCompactCurrency(Math.round(major * 100), currency).replace(/\.00$/, "");
}

export function formatAmount(cents: number): string {
  return formatCurrency(cents);
}

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateAvatarUrl(name: string, size = 40): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=7c3aed&color=fff&bold=true`;
}

export function truncate(str: string, length = 30): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const group = String(item[key]);
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Returns color class based on positive/negative amount */
export function amountColor(cents: number): string {
  if (cents > 0) return "text-green-600 dark:text-green-400";
  if (cents < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
