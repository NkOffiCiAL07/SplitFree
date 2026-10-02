import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});
const getRates = vi.fn();
vi.mock("@/lib/rates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rates")>("@/lib/rates");
  return { ...actual, getRates: (b: string) => getRates(b) };
});

import { GET } from "@/app/api/dashboard/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const peer = { name: "Pal", avatarUrl: null };
const day = new Date();

function seed({ owedSplits = [] as unknown[], oweSplits = [] as unknown[], settlements = [] as unknown[] }) {
  p.user.findUnique.mockResolvedValue({ currency: "INR" });
  // call order in the route: mySplits (I owe), myPaidSplits (they owe me)
  p.expenseSplit.findMany.mockResolvedValueOnce(oweSplits).mockResolvedValueOnce(owedSplits);
  p.group.count.mockResolvedValue(1);
  p.activity.findMany.mockResolvedValue([]);
  p.group.findFirst.mockResolvedValue({ currency: "INR" });
  p.settlement.findMany.mockResolvedValue(settlements);
}
const owed = (amount: number, currency: string) =>
  ({ amount, userId: OTHER, expense: { date: day, currency }, user: peer });

beforeEach(() => {
  resetPrisma();
  getRates.mockReset();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.upsert.mockResolvedValue({});
  p.user.findUnique.mockResolvedValue({ currency: "INR" });
});

describe("GET /api/dashboard", () => {
  it("totals only the primary currency in the headline and lists the rest separately", async () => {
    seed({ owedSplits: [owed(100000, "INR"), owed(5000, "USD")] });
    getRates.mockResolvedValue(null);
    const { data } = await (await GET()).json();
    expect(data.currency).toBe("INR");
    expect(data.stats.totalOwed).toBe(100000);
    expect(data.stats.otherCurrencies).toEqual([{ currency: "USD", owed: 5000, owing: 0 }]);
    expect(data.stats.combined).toBeNull(); // rates unavailable → no estimate, no crash
  });

  it("adds an approximate combined total when live rates are available", async () => {
    seed({ owedSplits: [owed(100000, "INR"), owed(1000, "USD")] });
    getRates.mockResolvedValue({ base: "INR", date: "2026-10-01", rates: { USD: 0.0125 } }); // $10 = ₹800
    const { data } = await (await GET()).json();
    expect(getRates).toHaveBeenCalledWith("INR");
    expect(data.stats.combined).toMatchObject({ owed: 180000, owing: 0, net: 180000, complete: true, date: "2026-10-01" });
  });

  it("flags the estimate as incomplete when a currency has no rate", async () => {
    seed({ owedSplits: [owed(100000, "INR"), owed(1000, "EUR")] });
    getRates.mockResolvedValue({ base: "INR", date: "d", rates: { USD: 0.0125 } });
    const { data } = await (await GET()).json();
    expect(data.stats.combined).toMatchObject({ owed: 100000, complete: false });
  });

  it("does not call the rate service when everything is in one currency", async () => {
    seed({ owedSplits: [owed(100000, "INR")] });
    const { data } = await (await GET()).json();
    expect(getRates).not.toHaveBeenCalled();
    expect(data.stats.combined).toBeNull();
  });

  it("counts old debts: totals are all-time, not limited to six months", async () => {
    seed({ owedSplits: [{ amount: 7000, userId: OTHER, expense: { date: new Date("2020-01-01"), currency: "INR" }, user: peer }] });
    const { data } = await (await GET()).json();
    expect(data.stats.totalOwed).toBe(7000);
    // …but the 6-month chart does not include it
    expect(data.monthly.every((m: { owed: number }) => m.owed === 0)).toBe(true);
  });
});
