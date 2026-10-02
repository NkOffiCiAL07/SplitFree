import { formatCurrency } from "@/lib/utils";

/** Normalised view of an expense, used to compute what an edit changed. */
export interface ExpenseSnapshot {
  description: string;
  amount: number; // cents
  currency: string;
  category: string;
  date: string; // YYYY-MM-DD
  notes: string | null;
  splitType: string;
  paidBy: string; // primary payer
  payers: { userId: string; amount: number }[]; // empty = single payer
  participants: string[]; // sorted user ids
  shares: Record<string, number>; // userId → cents
  isRecurring: boolean;
  recurringInterval: string | null;
}

export type Changes = Record<string, { from: unknown; to: unknown }>;

interface SnapshotInput {
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: Date | string;
  notes?: string | null;
  splitType: string;
  paidById: string;
  isRecurring: boolean;
  recurringInterval?: string | null;
  splits: { userId: string; amount: number }[];
  payers?: { userId: string; amount: number }[];
}

export function snapshotExpense(e: SnapshotInput): ExpenseSnapshot {
  return {
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    date: new Date(e.date).toISOString().slice(0, 10),
    notes: e.notes ?? null,
    splitType: e.splitType,
    paidBy: e.paidById,
    payers: [...(e.payers ?? [])].sort((a, b) => a.userId.localeCompare(b.userId)),
    participants: e.splits.map((s) => s.userId).sort(),
    // sorted keys so JSON comparison doesn't depend on split order
    shares: Object.fromEntries(e.splits.map((s) => [s.userId, s.amount] as const).sort(([x], [y]) => x.localeCompare(y))),
    isRecurring: e.isRecurring,
    recurringInterval: e.recurringInterval ?? null,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Field-by-field before/after; empty object when nothing changed. */
export function diffSnapshots(before: ExpenseSnapshot, after: ExpenseSnapshot): Changes {
  const changes: Changes = {};
  const keys: (keyof ExpenseSnapshot)[] = [
    "description", "amount", "currency", "category", "date", "notes", "splitType",
    "paidBy", "payers", "participants", "shares", "isRecurring", "recurringInterval",
  ];
  for (const k of keys) {
    if (!same(before[k], after[k])) changes[k] = { from: before[k], to: after[k] };
  }
  // `shares` only matters on its own when the same people stayed but amounts moved
  if (changes.shares && changes.amount && !changes.participants && !changes.splitType) {
    delete changes.shares; // an amount change implies the shares moved — not worth a separate line
  }
  return changes;
}

const LABELS: Record<string, string> = {
  description: "Description", amount: "Amount", currency: "Currency", category: "Category", date: "Date",
  notes: "Notes", splitType: "Split type", paidBy: "Paid by", payers: "Payers", participants: "Split between",
  shares: "Shares", isRecurring: "Recurring", recurringInterval: "Repeat",
};

const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** Human-readable line for one change ("Amount: ₹500.00 → ₹650.00"). */
export function describeChange(
  field: string,
  change: { from: unknown; to: unknown },
  nameOf: (userId: string) => string,
  currency = "INR"
): string {
  const label = LABELS[field] ?? field;
  switch (field) {
    case "amount":
      return `${label}: ${formatCurrency(Number(change.from), currency)} → ${formatCurrency(Number(change.to), currency)}`;
    case "paidBy":
      return `${label}: ${nameOf(String(change.from))} → ${nameOf(String(change.to))}`;
    case "payers": {
      const fmt = (v: unknown) => {
        const list = v as { userId: string; amount: number }[];
        return list.length === 0 ? "single payer" : list.map((p) => `${nameOf(p.userId)} ${formatCurrency(p.amount, currency)}`).join(", ");
      };
      return `${label}: ${fmt(change.from)} → ${fmt(change.to)}`;
    }
    case "participants": {
      const from = new Set(change.from as string[]);
      const to = new Set(change.to as string[]);
      const added = [...to].filter((id) => !from.has(id)).map(nameOf);
      const removed = [...from].filter((id) => !to.has(id)).map(nameOf);
      const parts = [added.length ? `added ${added.join(", ")}` : "", removed.length ? `removed ${removed.join(", ")}` : ""].filter(Boolean);
      return `${label}: ${parts.join("; ")}`;
    }
    case "shares":
      return "Individual shares were adjusted";
    case "isRecurring":
      return `${label}: ${change.to ? "turned on" : "turned off"}`;
    default:
      return `${label}: ${text(change.from)} → ${text(change.to)}`;
  }
}
