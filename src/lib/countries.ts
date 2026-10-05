/** Countries for the mobile-number country-code picker. India first (that's who the app is for), then A–Z. */
export interface Country { code: string; name: string; dial: string; /** a sample national number, for the placeholder */ example?: string }

const LIST: Country[] = [
  { code: "AE", name: "United Arab Emirates", dial: "971", example: "50 123 4567" },
  { code: "AU", name: "Australia", dial: "61", example: "412 345 678" },
  { code: "BD", name: "Bangladesh", dial: "880", example: "1712 345678" },
  { code: "BE", name: "Belgium", dial: "32", example: "470 12 34 56" },
  { code: "BH", name: "Bahrain", dial: "973", example: "3600 1234" },
  { code: "BR", name: "Brazil", dial: "55", example: "11 91234 5678" },
  { code: "CA", name: "Canada", dial: "1", example: "416 555 0123" },
  { code: "CH", name: "Switzerland", dial: "41", example: "78 123 45 67" },
  { code: "CN", name: "China", dial: "86", example: "131 2345 6789" },
  { code: "DE", name: "Germany", dial: "49", example: "151 2345 6789" },
  { code: "DK", name: "Denmark", dial: "45", example: "20 12 34 56" },
  { code: "EG", name: "Egypt", dial: "20", example: "100 123 4567" },
  { code: "ES", name: "Spain", dial: "34", example: "612 34 56 78" },
  { code: "FR", name: "France", dial: "33", example: "6 12 34 56 78" },
  { code: "GB", name: "United Kingdom", dial: "44", example: "7911 123456" },
  { code: "GH", name: "Ghana", dial: "233", example: "24 123 4567" },
  { code: "HK", name: "Hong Kong", dial: "852", example: "5123 4567" },
  { code: "ID", name: "Indonesia", dial: "62", example: "812 3456 789" },
  { code: "IE", name: "Ireland", dial: "353", example: "85 123 4567" },
  { code: "IL", name: "Israel", dial: "972", example: "50 123 4567" },
  { code: "IN", name: "India", dial: "91", example: "98765 43210" },
  { code: "IT", name: "Italy", dial: "39", example: "312 345 6789" },
  { code: "JP", name: "Japan", dial: "81", example: "90 1234 5678" },
  { code: "KE", name: "Kenya", dial: "254", example: "712 345678" },
  { code: "KR", name: "South Korea", dial: "82", example: "10 1234 5678" },
  { code: "KW", name: "Kuwait", dial: "965", example: "500 12345" },
  { code: "LK", name: "Sri Lanka", dial: "94", example: "71 234 5678" },
  { code: "MX", name: "Mexico", dial: "52", example: "55 1234 5678" },
  { code: "MY", name: "Malaysia", dial: "60", example: "12 345 6789" },
  { code: "NG", name: "Nigeria", dial: "234", example: "802 123 4567" },
  { code: "NL", name: "Netherlands", dial: "31", example: "6 12345678" },
  { code: "NO", name: "Norway", dial: "47", example: "406 12 345" },
  { code: "NP", name: "Nepal", dial: "977", example: "984 1234567" },
  { code: "NZ", name: "New Zealand", dial: "64", example: "21 123 4567" },
  { code: "OM", name: "Oman", dial: "968", example: "9212 3456" },
  { code: "PH", name: "Philippines", dial: "63", example: "917 123 4567" },
  { code: "PK", name: "Pakistan", dial: "92", example: "301 2345678" },
  { code: "PL", name: "Poland", dial: "48", example: "512 345 678" },
  { code: "PT", name: "Portugal", dial: "351", example: "912 345 678" },
  { code: "QA", name: "Qatar", dial: "974", example: "3312 3456" },
  { code: "RU", name: "Russia", dial: "7", example: "912 345 67 89" },
  { code: "SA", name: "Saudi Arabia", dial: "966", example: "50 123 4567" },
  { code: "SE", name: "Sweden", dial: "46", example: "70 123 45 67" },
  { code: "SG", name: "Singapore", dial: "65", example: "8123 4567" },
  { code: "TH", name: "Thailand", dial: "66", example: "81 234 5678" },
  { code: "TR", name: "Türkiye", dial: "90", example: "501 234 56 78" },
  { code: "TZ", name: "Tanzania", dial: "255", example: "621 234 567" },
  { code: "UG", name: "Uganda", dial: "256", example: "712 345678" },
  { code: "US", name: "United States", dial: "1", example: "415 555 2671" },
  { code: "VN", name: "Vietnam", dial: "84", example: "91 234 56 78" },
  { code: "ZA", name: "South Africa", dial: "27", example: "71 123 4567" },
];

export const COUNTRIES: Country[] = [LIST.find((c) => c.code === "IN")!, ...LIST.filter((c) => c.code !== "IN")];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export const countryByCode = (code: string | null | undefined): Country | undefined => BY_CODE.get((code ?? "").toUpperCase());

/** Dial code (no +) for a country, or undefined when we don't list it. */
export const dialFor = (code: string | null | undefined): string | undefined => countryByCode(code)?.dial;

/** 🇮🇳 for "IN" (regional-indicator letters; some desktop systems show the letters instead, which is still readable). */
export const flagOf = (code: string): string => String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));

/** "+919876543210" → { country: "IN", national: "9876543210" } (+1 is shared by the US and Canada: it resolves to the US, and the picker lets people switch). */
export function parseE164(e164: string | null | undefined): { country: string; national: string } | null {
  const m = /^\+(\d{8,15})$/.exec((e164 ?? "").trim());
  if (!m) return null;
  const digits = m[1];
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len);
    const hit = (prefix === "1" ? BY_CODE.get("US") : undefined) ?? COUNTRIES.find((c) => c.dial === prefix); // +1 is shared with Canada: show the US
    if (hit) return { country: hit.code, national: digits.slice(len) };
  }
  return null;
}
