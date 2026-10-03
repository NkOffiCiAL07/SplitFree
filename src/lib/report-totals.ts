import { expensePayments } from "@/lib/ledger";
import { sumInHome, type Converter, type HomeTotal } from "@/lib/convert-core";

export interface ReportExpense {
  amount: number;
  currency: string;
  paidById: string;
  payers?: { userId: string; amount: number }[];
  splits: { userId: string; amount: number }[];
}

/** What the user paid and what their share was across a list of expenses, in the home currency (flagged approximate). */
export function reportTotals(expenses: ReportExpense[], userId: string, conv: Converter): { paid: HomeTotal; share: HomeTotal } {
  const paid = expenses.map((e) => ({
    currency: e.currency,
    amount: expensePayments(e).filter((p) => p.userId === userId).reduce((s, p) => s + p.amount, 0),
  }));
  const share = expenses.map((e) => ({
    currency: e.currency,
    amount: e.splits.filter((s) => s.userId === userId).reduce((s, x) => s + x.amount, 0),
  }));
  return { paid: sumInHome(paid, conv), share: sumInHome(share, conv) };
}
