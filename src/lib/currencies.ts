/**
 * Single source of truth for supported currencies.
 * INR is first (and the default) because most users are in India — every dropdown,
 * validator and fallback in the app derives from this list.
 */
export const CURRENCY_CODES = ["INR", "USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "INR";
