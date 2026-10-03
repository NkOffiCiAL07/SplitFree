import { pairNets, type Edge } from "@/lib/ledger";

/**
 * Account deletion never removes the user row: expenses, splits and payments of OTHER people reference it, and
 * deleting it would cascade through all of them. Instead the row is anonymised (name, email, picture, UPI removed) and
 * the sign-in is deleted, so shared history stays correct and nobody else loses money records.
 */
export const DELETED_NAME = "Deleted user";
const DELETED_DOMAIN = "deleted.invalid"; // reserved TLD: can never be a real address

export const deletedEmail = (userId: string) => `deleted-${userId}@${DELETED_DOMAIN}`;

export const isDeletedAccount = (email?: string | null) => !!email && email.toLowerCase().endsWith(`@${DELETED_DOMAIN}`);

/** Thrown when a still-valid sign-in token belongs to an account that has been deleted. */
export class AccountDeletedError extends Error {
  constructor() {
    super("This account has been deleted.");
    this.name = "AccountDeletedError";
  }
}

export interface BalanceBlocker {
  userId: string;
  currency: string;
  /** positive = they owe you, negative = you owe them (stored units) */
  net: number;
}

/** Everyone the user still has a non-zero balance with. Deleting is refused until this is empty. */
export function balanceBlockers(edges: Edge[], userId: string): BalanceBlocker[] {
  const out: BalanceBlocker[] = [];
  for (const [other, byCurrency] of pairNets(edges, userId)) {
    for (const [currency, net] of byCurrency) if (net !== 0) out.push({ userId: other, currency, net });
  }
  return out;
}
