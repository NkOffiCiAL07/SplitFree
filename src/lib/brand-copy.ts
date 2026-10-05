/**
 * The product's voice, shared by the landing page and the sign-in screens: plain, a little Hinglish, and about the
 * real problem (awkward money talks between friends) — not a feature list.
 */
export const HEADLINE_LINE_1 = "Hisaab saaf.";
export const HEADLINE_LINE_2 = "Dosti barkaraar.";
export const HEADLINE = `${HEADLINE_LINE_1} ${HEADLINE_LINE_2}`;
export const SUBLINE = "No more “bhai, paise kab doge?” Split trips, rent and dinners with friends, then settle up on UPI in one tap.";
/** What it's for, cycled under the headline */
export const OCCASIONS = ["Goa trips", "flat rent", "office lunches", "shaadi kharcha", "chai-nashta runs"];

/**
 * The same voice for people outside India, in plain English (the Hinglish lines only make sense in India).
 * `brandCopy(region)` picks the right set; the constants above stay the India defaults.
 */
import type { Region } from "@/lib/region";

export interface BrandCopy {
  line1: string;
  line2: string;
  subline: string;
  occasions: string[];
  /** scrolling chips on phones */
  chips: string[];
  /** the live-activity card: who paid, how much, and the trip it settled */
  feed: { payer: string; amount: string; trip: string };
}

export function brandCopy(region: Region): BrandCopy {
  if (region.isIndia) {
    return {
      line1: HEADLINE_LINE_1,
      line2: HEADLINE_LINE_2,
      subline: SUBLINE,
      occasions: OCCASIONS,
      chips: ["✅ Asha settled ₹850 on UPI", "🏖️ Goa trip squared up", "🍕 Dinner split 4 ways", "⚡ Fewer payments, same result", "🏠 Rent split, no awkward chats", "📲 Pay in one tap"],
      feed: { payer: "Asha", amount: region.amount, trip: "Goa trip" },
    };
  }
  return {
    line1: "Settle up.",
    line2: "Stay friends.",
    subline: "No more awkward “so… when are you paying me back?” Split trips, rent and dinners with friends, then settle up in one tap.",
    occasions: ["weekend trips", "flat rent", "office lunches", "road trips", "group gifts", "dinners out"],
    chips: [`✅ Asha paid you back ${region.amount}`, "🏖️ Beach trip squared up", "🍕 Dinner split 4 ways", "⚡ Fewer payments, same result", "🏠 Rent split, no awkward chats", "📲 Settle up in one tap"],
    feed: { payer: "Asha", amount: region.amount, trip: "Beach trip" },
  };
}

