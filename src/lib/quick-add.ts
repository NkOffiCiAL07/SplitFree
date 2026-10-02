export interface QuickExpense {
  description: string;
  /** Amount in major units (dollars/rupees), or null when none was found */
  amount: number | null;
  /** Names mentioned after "with" */
  names: string[];
}

const NAME_SEPARATOR = /\s*(?:,|&|\band\b|\+)\s*/i;

/** Parses "1.2k", "1,200.50", "₹500", "$12" → number (major units), or null. */
function parseAmountToken(token: string): number | null {
  const m = token.replace(/[₹$€£,]/g, "").match(/^(\d+(?:\.\d+)?)(k)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Turns free text like "Dinner 1200 with Rahul and Priya" into form values.
 * The last money-looking number is the amount; names come from after "with".
 */
export function parseQuickExpense(input: string): QuickExpense {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return { description: "", amount: null, names: [] };

  const withIdx = text.search(/\bwith\b/i);
  const head = withIdx >= 0 ? text.slice(0, withIdx).trim() : text;
  const tail = withIdx >= 0 ? text.slice(withIdx + 4).trim() : "";

  const words = head.split(" ");
  // The LAST number-looking word is the amount ("2 tickets 800" → 800, "iPhone 15 case 500" → 500)
  let amountIdx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (parseAmountToken(words[i]) !== null) { amountIdx = i; break; }
  }
  const amount = amountIdx >= 0 ? parseAmountToken(words[amountIdx]) : null;
  const rest = words.filter((w, i) => i !== amountIdx && !/^(for|of|rs\.?|inr|usd|eur|gbp)$/i.test(w));

  const description = rest.join(" ").replace(/[-–:]+$/g, "").trim();
  const names = tail ? tail.split(NAME_SEPARATOR).map((n) => n.trim()).filter(Boolean) : [];

  return {
    description: description ? description.charAt(0).toUpperCase() + description.slice(1) : "",
    amount,
    names,
  };
}

/** Case-insensitive match of typed names against people: full name, first name, or unique prefix. */
export function matchPeople<T extends { id: string; name?: string | null }>(names: string[], people: T[]): { matched: T[]; unmatched: string[] } {
  const matched: T[] = [];
  const unmatched: string[] = [];
  for (const raw of names) {
    const n = raw.toLowerCase();
    const exact = people.filter((p) => (p.name ?? "").toLowerCase() === n || (p.name ?? "").toLowerCase().split(" ")[0] === n);
    const hits = exact.length ? exact : people.filter((p) => (p.name ?? "").toLowerCase().startsWith(n));
    if (hits.length >= 1 && !matched.includes(hits[0])) matched.push(hits[0]);
    else if (hits.length === 0) unmatched.push(raw);
  }
  return { matched, unmatched };
}
