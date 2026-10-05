/**
 * Mobile numbers are stored in international format (E.164, e.g. +919876543210) and shown grouped.
 * India-first: a bare 10-digit number (or one with a leading 0 / 91) is an Indian mobile, which starts with 6–9.
 * Numbers from other countries must be typed with their + country code (unless we know the visitor's country).
 */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Returns the number as +<country><digits>, or null if it isn't a plausible mobile number. */
export function normalizePhone(input: string | null | undefined, defaultDial?: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw || /[^\d+\s().-]/.test(raw)) return null; // letters and other symbols are never part of a number
  let digits = raw.replace(/\D/g, "");

  const international = raw.startsWith("+") || raw.startsWith("00");
  if (raw.startsWith("00")) digits = digits.slice(2);

  if (international) {
    if (digits.startsWith("91")) return INDIAN_MOBILE.test(digits.slice(2)) ? `+${digits}` : null;
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null; // E.164: at most 15 digits
  }
  // A visitor whose country we know (and isn't India) can type their own national number (415 555 2671, 07911 123456);
  // their country's rules win over the Indian shortcuts below
  if (defaultDial && defaultDial !== "91") {
    const national = digits.startsWith("0") ? digits.slice(1) : digits;
    const full = `${defaultDial}${national}`;
    return national.length >= 6 && /^[1-9]\d{7,14}$/.test(full) ? `+${full}` : null;
  }

  if (digits.length === 10 && INDIAN_MOBILE.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0") && INDIAN_MOBILE.test(digits.slice(1))) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91") && INDIAN_MOBILE.test(digits.slice(2))) return `+${digits}`;
  return null;
}

export const isValidPhone = (input: string | null | undefined, defaultDial?: string): boolean => normalizePhone(input, defaultDial) !== null;

/** "+919876543210" → "+91 98765 43210" (other countries are shown as stored). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** Accounts created from this moment on must have a mobile number (older accounts are only asked to add one in Settings). */
export const PHONE_REQUIRED_SINCE = "2026-10-05T00:00:00Z";

/** True when this person still has to add a number before using the app (new account, nothing saved yet). */
export function mustAddPhone(profile: { phone?: string | null; createdAt?: string | Date | null } | null | undefined): boolean {
  if (!profile || profile.phone || !profile.createdAt) return false;
  return new Date(profile.createdAt).getTime() >= Date.parse(PHONE_REQUIRED_SINCE);
}
