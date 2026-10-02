import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { formatCurrency } from "@/lib/utils";
import type { SimplifiedDebt } from "@/types";

/** Loose UPI id check: handle@bank (letters, digits, dots, dashes, underscores). */
export function isValidUpiId(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim());
}

/**
 * Builds a UPI deep link (opens GPay / PhonePe / Paytm etc. on a phone).
 * `amountCents` is in the smallest unit; UPI wants a decimal rupee amount.
 */
export function buildUpiLink(opts: { vpa: string; name?: string; amountCents: number; note?: string }): string | null {
  if (!isValidUpiId(opts.vpa) || opts.amountCents <= 0) return null;
  const params = new URLSearchParams({
    pa: opts.vpa.trim(),
    am: (opts.amountCents / 100).toFixed(2),
    cu: "INR",
  });
  if (opts.name) params.set("pn", opts.name);
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString()}`;
}

/** Plain-text settle plan for sharing in a chat ("Priya → Rahul: ₹500.00"). */
export function formatSettlePlan(debts: SimplifiedDebt[], currentUserId?: string, appName = "SplitFree"): string {
  if (debts.length === 0) return `${appName}: everyone is settled up ✅`;
  const name = (id: string, u?: { name: string }) => (id === currentUserId ? "You" : u?.name ?? "Someone");
  const lines = debts.map(
    (d) => `• ${name(d.fromUserId, d.fromUser)} → ${name(d.toUserId, d.toUser)}: ${formatCurrency(d.amount, d.currency ?? DEFAULT_CURRENCY)}`
  );
  return [`${appName} — settle plan (${debts.length} payment${debts.length === 1 ? "" : "s"})`, ...lines].join("\n");
}
