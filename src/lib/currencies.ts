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

const EURO_COUNTRIES = new Set(["DE", "FR", "ES", "IT", "NL", "PT", "IE", "BE", "AT", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"]);

/** The currency people pay in where they live: India pays in INR, the UK in GBP, and so on (USD where we have no better answer). */
export function currencyForCountry(country?: string | null): CurrencyCode {
  const c = (country ?? "").trim().toUpperCase();
  if (!c || c === "IN") return "INR";
  if (c === "GB") return "GBP";
  if (c === "JP") return "JPY";
  if (c === "CA") return "CAD";
  if (c === "AU") return "AUD";
  if (EURO_COUNTRIES.has(c)) return "EUR";
  return "USD";
}
