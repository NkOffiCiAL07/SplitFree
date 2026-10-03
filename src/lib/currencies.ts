/**
 * Single source of truth for supported currencies.
 * INR is first (and the default) because most users are in India — every dropdown,
 * validator and fallback in the app derives from this list.
 */
export const CURRENCY_CODES = ["INR", "USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

/**
 * Amounts are stored as integers in 1/100ths of the main unit for every currency. Yen has no sub-unit, so JPY
 * amounts must always be whole yen, i.e. multiples of 100 stored units. This is the granularity to enforce.
 */
export function storedUnitFor(currency: string): number {
  return currency === "JPY" ? 100 : 1;
}

/** True if a stored amount is a legal amount of that currency (whole yen for JPY). */
export function isLegalAmount(storedAmount: number, currency: string): boolean {
  return Number.isInteger(storedAmount) && storedAmount % storedUnitFor(currency) === 0;
}
