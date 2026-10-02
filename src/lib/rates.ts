import { CURRENCY_CODES } from "@/lib/currencies";

export interface Rates {
  base: string;
  /** 1 unit of `base` = rates[code] units of `code` */
  rates: Record<string, number>;
  date: string;
}

const API = "https://api.frankfurter.dev/v1/latest";
const SIX_HOURS = 6 * 60 * 60;

/**
 * Live exchange rates (ECB reference rates via frankfurter.dev — free, no key).
 * Returns null on any failure so callers can simply skip conversion; cached for 6 hours.
 */
export async function getRates(base: string): Promise<Rates | null> {
  try {
    const symbols = CURRENCY_CODES.filter((c) => c !== base).join(",");
    const res = await fetch(`${API}?base=${encodeURIComponent(base)}&symbols=${symbols}`, {
      next: { revalidate: SIX_HOURS },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> };
    if (!json.rates || typeof json.rates !== "object") return null;
    return { base, rates: json.rates, date: json.date ?? "" };
  } catch {
    return null;
  }
}

/** Converts an amount (minor units) from `from` into `r.base`. Returns null if the rate is unknown. */
export function convertToBase(amount: number, from: string, r: Rates): number | null {
  if (from === r.base) return amount;
  const rate = r.rates[from];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amount / rate);
}
