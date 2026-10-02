export interface PairExpense {
  paidById: string;
  currency: string;
  splits: { userId: string; amount: number }[];
}
export interface PairSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
}
export interface CurrencyNet { currency: string; net: number }

/**
 * Net balance between two people, one entry per currency (never mixed).
 * Positive = the friend owes you, negative = you owe the friend. Zero balances are omitted.
 */
export function computePairBalances(
  me: string,
  friend: string,
  expenses: PairExpense[],
  settlements: PairSettlement[]
): CurrencyNet[] {
  const nets = new Map<string, number>();
  const bump = (currency: string, amount: number) => nets.set(currency, (nets.get(currency) ?? 0) + amount);

  for (const e of expenses) {
    for (const s of e.splits) {
      if (e.paidById === me && s.userId === friend) bump(e.currency, s.amount); // they owe me their share
      else if (e.paidById === friend && s.userId === me) bump(e.currency, -s.amount); // I owe them mine
    }
  }
  for (const st of settlements) {
    if (st.fromUserId === me && st.toUserId === friend) bump(st.currency, st.amount); // I paid them
    else if (st.fromUserId === friend && st.toUserId === me) bump(st.currency, -st.amount); // they paid me
  }

  return [...nets.entries()]
    .filter(([, net]) => net !== 0)
    .map(([currency, net]) => ({ currency, net }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
