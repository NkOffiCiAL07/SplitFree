import { CURRENCY_CODES, isLegalAmount } from "@/lib/currencies";

/**
 * Splitwise "Export as CSV" → expenses and settlements.
 *
 * File shape: `Date,Description,Category,Cost,Currency,<person>,<person>,…` where every person
 * column is that person's NET for the row: `paid − share` (positive = they're owed, negative =
 * they owe). The file ends with a "Total balance" line. "Payment" rows are settle-ups.
 */

export interface SplitwiseRow {
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  /** Cost in cents */
  cost: number;
  currency: string;
  /** Person name → net in cents (non-zero only) */
  nets: Record<string, number>;
  isPayment: boolean;
}

export interface ParsedSplitwise {
  people: string[];
  rows: SplitwiseRow[];
  warnings: string[];
}

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** "1,234.56" / "-20.00" / "(20.00)" → cents, or null if it isn't a number. */
export function toCentsLoose(raw: string): number | null {
  const t = raw.trim().replace(/[,\s]/g, "");
  if (t === "") return null;
  const negative = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100);
}

/** Accepts YYYY-MM-DD (Splitwise), ISO timestamps, and D/M/Y or M/D/Y when unambiguous. */
export function normaliseDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, a, b] = m;
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const [x, z] = [parseInt(a, 10), parseInt(b, 10)];
    // A day can't exceed 31 and a month can't exceed 12 — use that to tell the formats apart
    const [day, month] = x > 12 ? [x, z] : z > 12 ? [z, x] : [x, z]; // ambiguous → day first
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

const FIXED_COLUMNS = ["date", "description", "category", "cost", "currency"];

export function parseSplitwiseCsv(text: string): ParsedSplitwise {
  const table = parseCsv(text);
  const warnings: string[] = [];
  if (table.length === 0) return { people: [], rows: [], warnings: ["The file is empty."] };

  const header = table[0].map((h) => h.trim());
  const looksRight = FIXED_COLUMNS.every((col, i) => header[i]?.toLowerCase() === col);
  if (!looksRight || header.length < 6) {
    return { people: [], rows: [], warnings: ["This doesn't look like a Splitwise export (expected columns: Date, Description, Category, Cost, Currency, then one column per person)."] };
  }
  const people = header.slice(5).filter(Boolean);
  const rows: SplitwiseRow[] = [];

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const description = (cells[1] ?? "").trim();
    if (!cells[0]?.trim() || /^total balance$/i.test(description)) return; // totals / spacer lines

    const date = normaliseDate(cells[0]);
    const cost = toCentsLoose(cells[3] ?? "");
    const currency = (cells[4] ?? "").trim().toUpperCase();
    if (!date) { warnings.push(`Line ${line}: unreadable date "${cells[0]}" — skipped.`); return; }
    if (cost === null || cost <= 0) { warnings.push(`Line ${line}: "${description}" has no valid cost — skipped.`); return; }
    if (!(CURRENCY_CODES as readonly string[]).includes(currency)) {
      warnings.push(`Line ${line}: "${description}" is in ${currency || "an unknown currency"}, which isn't supported — skipped.`);
      return;
    }

    const nets: Record<string, number> = {};
    people.forEach((name, i) => {
      const v = toCentsLoose(cells[5 + i] ?? "");
      if (v) nets[name] = v;
    });
    // Yen has no sub-unit: a fractional yen amount can't be stored consistently, so skip it rather than guess
    if (!isLegalAmount(cost, currency) || Object.values(nets).some((v) => !isLegalAmount(v, currency))) {
      warnings.push(`Line ${line}: "${description}" has fractional ${currency} amounts, which that currency doesn't use — skipped.`);
      return;
    }
    if (Object.keys(nets).length === 0) { warnings.push(`Line ${line}: "${description}" involves nobody — skipped.`); return; }

    const category = (cells[2] ?? "").trim();
    rows.push({ date, description, category, cost, currency, nets, isPayment: /^payment$/i.test(category) || /^settle all balances$/i.test(description) });
  });

  return { people, rows, warnings };
}

/** Splitwise category → ours. */
export function mapCategory(category: string): string {
  const c = category.toLowerCase();
  const rules: [RegExp, string][] = [
    [/dining|groceries|liquor|food|restaurant|coffee|snack|meal/, "FOOD"],
    [/taxi|bus|train|car\b|gas|fuel|parking|plane|flight|bicycle|transport|cab|metro|toll/, "TRANSPORT"],
    [/hotel|rent|mortgage|accommodation|lodging|hostel|home|house|pg\b/, "ACCOMMODATION"],
    [/movie|music|game|sport|entertain|party|concert|tickets?/, "ENTERTAINMENT"],
    [/electric|heat|water|clean|utilit|tv|phone|internet|wifi|trash|bill/, "UTILITIES"],
    [/cloth|electronic|furniture|household|shopping|gift|supplies/, "SHOPPING"],
    [/medic|insurance|health|doctor|pharmacy|dental|gym/, "HEALTH"],
    [/trip|travel|vacation|holiday|tour/, "TRAVEL"],
    [/educat|school|college|book|course|tuition/, "EDUCATION"],
  ];
  return rules.find(([re]) => re.test(c))?.[1] ?? "OTHER";
}

// ─── Converting a row (names) into app records (user ids) ────────────────────

export interface ImportedExpense {
  date: string;
  description: string;
  category: string;
  currency: string;
  amount: number; // cents
  paidById: string; // primary payer
  payers: { userId: string; amount: number }[]; // empty = single payer
  splits: { userId: string; amount: number }[]; // exact amounts in cents
}

export interface ImportedSettlement {
  date: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  note: string;
}

export type RowResult =
  | { kind: "expense"; expense: ImportedExpense }
  | { kind: "settlement"; settlement: ImportedSettlement }
  | { kind: "skip"; reason: string };

/**
 * Reconstructs who paid and who consumed from the net columns.
 *  - Each negative net is that person's share (they consumed more than they paid).
 *  - Each positive net is a payer. One payer paid the whole cost; with several, the cost left over
 *    after the debtors' shares is split evenly between the payers as their own shares.
 */
export function rowToRecord(row: SplitwiseRow, mapping: Record<string, string>): RowResult {
  const entries = Object.entries(row.nets);
  const unmapped = entries.filter(([name]) => !mapping[name]).map(([name]) => name);
  if (unmapped.length > 0) return { kind: "skip", reason: `${row.description}: no match chosen for ${unmapped.join(", ")}` };

  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (Math.abs(sum) > entries.length) return { kind: "skip", reason: `${row.description}: balances don't add up to zero` };

  const creditors = entries.filter(([, v]) => v > 0).map(([n, v]) => ({ userId: mapping[n], net: v }));
  const debtors = entries.filter(([, v]) => v < 0).map(([n, v]) => ({ userId: mapping[n], owes: -v }));
  if (creditors.length === 0 || debtors.length === 0) return { kind: "skip", reason: `${row.description}: no payer or no one owing` };

  if (row.isPayment) {
    // In Splitwise the person who paid carries the positive net, the recipient the negative
    return {
      kind: "settlement",
      settlement: { date: row.date, fromUserId: creditors[0].userId, toUserId: debtors[0].userId, amount: row.cost, currency: row.currency, note: "Imported from Splitwise" },
    };
  }

  const debtTotal = debtors.reduce((a, d) => a + d.owes, 0);
  const payerShareTotal = row.cost - debtTotal; // what the payers consumed themselves
  if (payerShareTotal < 0) return { kind: "skip", reason: `${row.description}: shares exceed the cost` };

  const k = creditors.length;
  const evenShare = Math.floor(payerShareTotal / k);
  const shareRemainder = payerShareTotal - evenShare * k;

  const payers = creditors.map((c, i) => ({ userId: c.userId, share: evenShare + (i === 0 ? shareRemainder : 0), net: c.net }))
    .map((c) => ({ userId: c.userId, share: c.share, paid: c.net + c.share }));

  const splitMap = new Map<string, number>();
  for (const d of debtors) splitMap.set(d.userId, (splitMap.get(d.userId) ?? 0) + d.owes);
  for (const p of payers) if (p.share > 0) splitMap.set(p.userId, (splitMap.get(p.userId) ?? 0) + p.share);

  const primary = [...payers].sort((a, b) => b.paid - a.paid)[0];
  return {
    kind: "expense",
    expense: {
      date: row.date,
      description: row.description,
      category: mapCategory(row.category),
      currency: row.currency,
      amount: row.cost,
      paidById: primary.userId,
      payers: payers.length > 1 ? payers.map((p) => ({ userId: p.userId, amount: p.paid })) : [],
      splits: [...splitMap.entries()].map(([userId, amount]) => ({ userId, amount })),
    },
  };
}
