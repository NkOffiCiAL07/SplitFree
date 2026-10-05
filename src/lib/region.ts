import { countryByCode, dialFor } from "@/lib/countries";

/**
 * Where a visitor is, as far as the words and examples on the sign-in and landing pages go.
 * The country comes from the host's request header (Vercel: x-vercel-ip-country). With no header (local development,
 * tests) we assume India — that's who the product is built for — while any OTHER country gets plain English.
 */
export interface Region {
  /** ISO country code, upper case ("IN"), or "" when unknown */
  country: string;
  isIndia: boolean;
  /** Dial code (no +) used to understand a national number typed without it, when we know the country */
  dial?: string;
  /** Currency symbol and a believable small amount, for examples ("₹850", "$20") */
  amount: string;
  /** A sample mobile number in the local style, for the placeholder */
  phoneExample: string;
}

const EUROZONE = new Set(["DE", "FR", "ES", "IT", "NL", "PT", "IE", "BE", "AT", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"]);

function amountFor(country: string): string {
  if (country === "IN") return "₹850";
  if (country === "GB") return "£15";
  if (country === "JP") return "¥2,000";
  if (country === "AE") return "AED 75";
  if (EUROZONE.has(country)) return "€18";
  return "$20";
}

/**
 * The visitor's country as far as the browser knows it, for client-only screens that have no server header.
 * The time zone wins for India (many Indians browse in "English (US)", so the language alone would guess the US);
 * otherwise the language's region ("en-GB" → "GB"); India when nothing is known. It is only a starting point: the
 * country picker always shows the choice and can be changed.
 */
export function browserCountry(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "IN";
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    const m = /[-_]([A-Za-z]{2})\b/.exec(lang ?? "");
    return (m ? m[1] : "IN").toUpperCase();
  } catch {
    return "IN";
  }
}

export function regionFor(country?: string | null): Region {
  const code = (country ?? "").trim().toUpperCase();
  if (!code || code === "IN") {
    return { country: code, isIndia: true, dial: "91", amount: "₹850", phoneExample: countryByCode("IN")!.example! };
  }
  return { country: code, isIndia: false, dial: dialFor(code), amount: amountFor(code), phoneExample: countryByCode(code)?.example ?? "+44 7911 123456" };
}
