import { CURRENCY_CODES, storedUnitFor } from "@/lib/currencies";

export interface Rates {
  base: string;
  /** 1 unit of `base` = rates[code] units of `code` */
  rates: Record<string, number>;
  date: string;
}

const API = "https://api.frankfurter.dev/v1/latest";
const SIX_HOURS = 6 * 60 * 60;

// ECB rates change once a day, so keep them in memory per server instance: a warm instance answers
// instantly, and concurrent requests share one in-flight fetch instead of each calling the API.
const cache = new Map<string, { at: number; value: Rates }>();
const inflight = new Map<string, Promise<Rates | null>>();

/** Test hook: forget cached rates. */
export function resetRatesCache() {
  cache.clear();
  inflight.clear();
}

/**
 * Live exchange rates (ECB reference rates via frankfurter.dev — free, no key).
 * Returns null on any failure so callers can simply skip conversion. Cached in memory for 6 hours.
 *
 * With `timeoutMs`, a slow rate service can't hold the caller up: it returns null after that long,
 * while the fetch carries on in the background so the next request finds the rates cached.
 */
export async function getRates(base: string, opts: { timeoutMs?: number } = {}): Promise<Rates | null> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < SIX_HOURS * 1000) return hit.value;

  let pending = inflight.get(base);
  if (!pending) {
    pending = fetchRates(base)
      .then((value) => {
        if (value) cache.set(base, { at: Date.now(), value });
        // The rate service is down: yesterday's rates are far better than none (summaries stay marked approximate)
        return value ?? hit?.value ?? null;
      })
      .finally(() => inflight.delete(base));
    inflight.set(base, pending);
  }
  if (!opts.timeoutMs) return pending;
  return Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.timeoutMs))]);
}

async function fetchRates(base: string): Promise<Rates | null> {
  try {
    const symbols = CURRENCY_CODES.filter((c) => c !== base).join(",");
    const res = await fetch(`${API}?base=${encodeURIComponent(base)}&symbols=${symbols}`, {
      next: { revalidate: SIX_HOURS },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> };
    if (!json.rates || typeof json.rates !== "object") return null;
    // Keep only usable rates: a zero/negative/NaN rate must never reach a division
    const rates = Object.fromEntries(Object.entries(json.rates).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0));
    if (Object.keys(rates).length === 0) return null;
    return { base, rates, date: json.date ?? "" };
  } catch {
    return null;
  }
}

/** Converts an amount (minor units) from `from` into `r.base`. Returns null if the rate is unknown. */
export function convertToBase(amount: number, from: string, r: Rates): number | null {
  if (from === r.base) return amount;
  const rate = r.rates[from];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  // Round to the base currency's smallest real unit (whole yen for JPY) so converted totals look like real money
  const unit = storedUnitFor(r.base);
  return Math.round(amount / rate / unit) * unit;
}
