import { toCents } from "@/lib/utils";

export type PayerAmounts = Record<string, string>; // userId → typed amount (major units)

/** Typed amounts → payers with a positive amount (major units). Blank/zero/invalid rows are ignored. */
export function parsePayers(amounts: PayerAmounts): { userId: string; amount: number }[] {
  return Object.entries(amounts)
    .map(([userId, raw]) => ({ userId, amount: parseFloat(raw) }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);
}

/** Cents still unassigned (positive = under-allocated, negative = over-allocated). */
export function payersRemainingCents(total: number, amounts: PayerAmounts): number {
  const paid = parsePayers(amounts).reduce((sum, p) => sum + toCents(p.amount), 0);
  return toCents(total) - paid;
}

/** Why the current multi-payer input can't be submitted (null when it's fine). */
export function payersProblem(total: number, amounts: PayerAmounts): string | null {
  const payers = parsePayers(amounts);
  if (!Number.isFinite(total) || total <= 0) return "Enter the total amount first";
  if (payers.length < 2) return "Enter amounts for at least two payers";
  const remaining = payersRemainingCents(total, amounts);
  if (remaining !== 0) return remaining > 0 ? "The payers' amounts are less than the total" : "The payers' amounts are more than the total";
  return null;
}

/** Splits `total` evenly across the given people (cents-exact; the first person absorbs the remainder). */
export function evenPayerAmounts(total: number, userIds: string[]): PayerAmounts {
  if (userIds.length === 0 || !(total > 0)) return {};
  const cents = toCents(total);
  const each = Math.floor(cents / userIds.length);
  const extra = cents - each * userIds.length;
  return Object.fromEntries(userIds.map((id, i) => [id, ((each + (i === 0 ? extra : 0)) / 100).toFixed(2)]));
}
