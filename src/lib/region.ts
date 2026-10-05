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

const DIAL: Record<string, string> = {
  IN: "91", US: "1", CA: "1", GB: "44", IE: "353", AU: "61", NZ: "64", AE: "971", SA: "966", SG: "65", MY: "60",
  DE: "49", FR: "33", ES: "34", IT: "39", NL: "31", PT: "351", ZA: "27", NG: "234", KE: "254", PK: "92", BD: "880",
  LK: "94", NP: "977", ID: "62", PH: "63", QA: "974", KW: "965", OM: "968", BH: "973",
};

const EUROZONE = new Set(["DE", "FR", "ES", "IT", "NL", "PT", "IE", "BE", "AT", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"]);

const PHONE_EXAMPLE: Record<string, string> = {
  IN: "98765 43210", US: "415 555 2671", CA: "416 555 0123", GB: "07911 123456", AU: "0412 345 678", AE: "050 123 4567", SG: "8123 4567",
};

function amountFor(country: string): string {
  if (country === "IN") return "₹850";
  if (country === "GB") return "£15";
  if (country === "JP") return "¥2,000";
  if (country === "AE") return "AED 75";
  if (EUROZONE.has(country)) return "€18";
  return "$20";
}

export function regionFor(country?: string | null): Region {
  const code = (country ?? "").trim().toUpperCase();
  if (!code || code === "IN") {
    return { country: code, isIndia: true, dial: "91", amount: "₹850", phoneExample: PHONE_EXAMPLE.IN };
  }
  return { country: code, isIndia: false, dial: DIAL[code], amount: amountFor(code), phoneExample: PHONE_EXAMPLE[code] ?? "+44 7911 123456" };
}
