import { describe, it, expect, vi, beforeEach } from "vitest";
import { format, subMonths } from "date-fns";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET } from "@/app/api/analytics/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const monthsAgo = (n: number) => { const d = subMonths(new Date(), n); d.setDate(15); return d; };
const myExpense = (amount: number, category: string, monthsBack = 0) => ({ id: Math.random(), category, date: monthsAgo(monthsBack), splits: [{ userId: ME, amount }] });

function seed(over: { expenses?: unknown[]; ledger?: unknown[]; groups?: unknown[]; currency?: string } = {}) {
  p.user.findUnique.mockResolvedValue({ currency: over.currency ?? "INR" });
  p.expense.findMany
    .mockResolvedValueOnce(over.expenses ?? [])   // my spending (analytics query)
    .mockResolvedValueOnce(over.ledger ?? []);    // ledger load
  p.settlement.findMany.mockResolvedValue([]);
  p.group.findMany.mockResolvedValue(over.groups ?? []);
}
const body = async () => (await GET()).json().then((j) => j.data);

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
});

describe("GET /api/analytics", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await GET()).status).toBe(401);
  });

  it("returns six months of buckets (oldest first), all zero when there is no spending", async () => {
    seed();
    const data = await body();
    expect(data.monthly).toHaveLength(6);
    expect(data.monthly.map((m: { month: string }) => m.month)).toEqual([5, 4, 3, 2, 1, 0].map((n) => format(subMonths(new Date(), n), "yyyy-MM")));
    expect(data.monthly.every((m: { total: number }) => m.total === 0)).toBe(true);
    expect(data).toMatchObject({ totalExpenses: 0, totalOwed: 0, totalOwing: 0, groupCount: 0, currency: "INR", categoryTotals: {} });
  });

  it("counts the user's SHARE (not the whole bill) per month and per category", async () => {
    seed({ expenses: [myExpense(30000, "FOOD", 0), myExpense(20000, "FOOD", 0), myExpense(50000, "TRAVEL", 2)] });
    const data = await body();
    const thisMonth = data.monthly[5];
    expect(thisMonth.total).toBe(50000);
    expect(thisMonth.byCategory).toEqual({ FOOD: 50000 });
    expect(data.monthly[3].total).toBe(50000);
    expect(data.categoryTotals).toEqual({ FOOD: 50000, TRAVEL: 50000 });
    expect(data.totalExpenses).toBe(100000);
  });

  it("asks the database only for the last six months, and rows without a share add nothing", async () => {
    seed({ expenses: [{ id: "x", category: "FOOD", date: monthsAgo(0), splits: [] }] });
    const data = await body();
    expect(data.totalExpenses).toBe(0);
    const gte: Date = p.expense.findMany.mock.calls[0][0].where.date.gte;
    const expected = subMonths(new Date(), 5);
    expect([gte.getFullYear(), gte.getMonth(), gte.getDate()]).toEqual([expected.getFullYear(), expected.getMonth(), 1]);
  });

  it("skips rows dated outside the six displayed months instead of crashing", async () => {
    seed({ expenses: [myExpense(10000, "FOOD", 9)] });
    const data = await body();
    expect(data.monthly.every((m: { total: number }) => m.total === 0)).toBe(true);
  });

  it("only counts expenses in the user's own currency (never sums rupees and dollars)", async () => {
    seed({ currency: "USD" });
    await GET();
    expect(p.expense.findMany.mock.calls[0][0].where).toMatchObject({ currency: "USD", splits: { some: { userId: ME } } });
  });

  it("falls back to INR when the profile has no currency", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    p.group.findMany.mockResolvedValue([]);
    expect((await body()).currency).toBe("INR");
  });

  it("reports what you're owed and what you owe from the shared ledger, primary currency only", async () => {
    const ledger = [
      { id: "1", paidById: ME, currency: "INR", amount: 1000, groupId: null, payers: [], splits: [{ userId: OTHER, amount: 600 }, { userId: ME, amount: 400 }] },
      { id: "2", paidById: "33333333-3333-4333-8333-333333333333", currency: "INR", amount: 500, groupId: null, payers: [], splits: [{ userId: ME, amount: 500 }] },
      { id: "3", paidById: OTHER, currency: "USD", amount: 9999, groupId: null, payers: [], splits: [{ userId: ME, amount: 9999 }] }, // other currency
    ];
    seed({ ledger });
    const data = await body();
    expect(data.totalOwed).toBe(600);
    expect(data.totalOwing).toBe(500);
  });

  it("counts only active groups (archived ones are excluded in the query)", async () => {
    seed({ groups: [{ id: "g1" }, { id: "g2" }] });
    const data = await body();
    expect(data.groupCount).toBe(2);
    expect(p.group.findMany.mock.calls[0][0].where).toEqual({ members: { some: { userId: ME } }, archivedAt: null });
  });

  it("is cached privately for a minute", async () => {
    seed();
    expect((await GET()).headers.get("Cache-Control")).toBe("private, max-age=60, stale-while-revalidate=120");
  });

  it("turns a database failure into a clean 500", async () => {
    p.user.findUnique.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET()).status).toBe(500);
  });
});
