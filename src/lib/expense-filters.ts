import type { ExpenseCategory, Prisma } from "@prisma/client";

const CATEGORIES: ExpenseCategory[] = [
  "FOOD", "TRANSPORT", "ACCOMMODATION", "ENTERTAINMENT", "UTILITIES", "SHOPPING", "HEALTH", "TRAVEL", "EDUCATION", "OTHER",
];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day (rejects 2026-02-31, which `new Date` would silently turn into an invalid date). */
function isRealDay(s: string | null): s is string {
  if (!s || !DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Turns the expenses list query string into a Prisma filter, so search/category/date/recurring run
 * over the user's FULL history on the server (not just the page that happens to be loaded).
 * Anything malformed is ignored rather than failing the request.
 */
export function buildExpenseFilter(params: URLSearchParams): Prisma.ExpenseWhereInput {
  const and: Prisma.ExpenseWhereInput[] = [];

  const groupId = params.get("groupId");
  if (groupId) and.push({ groupId });

  const q = params.get("q")?.trim().slice(0, 100);
  if (q) {
    and.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { paidBy: { name: { contains: q, mode: "insensitive" } } },
        { group: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const category = params.get("category");
  if (category && (CATEGORIES as string[]).includes(category)) and.push({ category: category as ExpenseCategory });

  const from = params.get("from");
  const to = params.get("to");
  if (isRealDay(from)) and.push({ date: { gte: new Date(`${from}T00:00:00.000Z`) } });
  if (isRealDay(to)) and.push({ date: { lte: new Date(`${to}T23:59:59.999Z`) } });

  if (params.get("recurring") === "true") and.push({ isRecurring: true });

  return and.length > 0 ? { AND: and } : {};
}
