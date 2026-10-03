import { convertToBase, type Rates } from "@/lib/rates";

/**
 * Turns amounts in any currency into the user's home currency (Settings → Home currency).
 *
 * Principles — these keep money screens honest:
 *  - Debts between people stay exact in their own currency (you settle what you owe, in that currency).
 *  - Summaries, charts and totals are shown in the home currency, always marked approximate ("≈") when anything
 *    was converted, with the rate date.
 *  - If a rate is unavailable, that amount is NOT dropped or guessed: it is reported in `skipped` so the screen can
 *    show it in its own currency and say the total is incomplete.
 */
export interface Converter {
  home: string;
  /** Rate date (ECB), "" when nothing needed converting or rates are unavailable */
  date: string;
  /** Amount in `from` → home currency (stored units), or null when there is no usable rate */
  toHome(amount: number, from: string): number | null;
}

export function makeConverter(home: string, rates: Rates | null): Converter {
  return {
    home,
    date: rates?.date ?? "",
    toHome(amount, from) {
      if (!Number.isFinite(amount)) return null;
      if (from === home) return amount;
      return rates ? convertToBase(amount, from, rates) : null;
    },
  };
}

export interface HomeTotal {
  currency: string;
  /** Sum of everything that could be expressed in the home currency */
  total: number;
  /** True when at least one amount in another currency was converted into `total` (so it's approximate) */
  approximate: boolean;
  /** True when every amount is included in `total` */
  complete: boolean;
  /** Amounts with no rate, left out of `total`, per currency */
  skipped: { currency: string; amount: number }[];
  date: string;
}

/** Adds up amounts in mixed currencies in the home currency. Never mixes raw numbers across currencies. */
export function sumInHome(items: Iterable<{ amount: number; currency: string }>, conv: Converter): HomeTotal {
  let total = 0;
  let approximate = false;
  const skipped = new Map<string, number>();
  for (const { amount, currency } of items) {
    const v = conv.toHome(amount, currency);
    if (v === null) {
      skipped.set(currency, (skipped.get(currency) ?? 0) + amount);
      continue;
    }
    if (currency !== conv.home && amount !== 0) approximate = true;
    total += v;
  }
  return {
    currency: conv.home,
    total,
    approximate,
    complete: skipped.size === 0,
    skipped: [...skipped.entries()].map(([currency, amount]) => ({ currency, amount })),
    date: approximate ? conv.date : "",
  };
}

