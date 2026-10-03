import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeConverter, sumInHome } from "@/lib/convert-core";
import { convertToBase, getRates, resetRatesCache } from "@/lib/rates";
import { CURRENCY_CODES, isLegalAmount, storedUnitFor } from "@/lib/currencies";
import { reportTotals } from "@/lib/report-totals";

const RATES = { base: "INR", date: "2026-10-01", rates: { USD: 0.0125, EUR: 0.0115, GBP: 0.0095, CAD: 0.017, AUD: 0.0185, JPY: 1.8 } };
const conv = makeConverter("INR", RATES);

function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

describe("makeConverter", () => {
  it("leaves home-currency amounts untouched and converts the rest", () => {
    expect(conv.toHome(12345, "INR")).toBe(12345);
    expect(conv.toHome(1000, "USD")).toBe(80000); // $10 → ₹800
    expect(conv.toHome(0, "USD")).toBe(0);
  });

  it("returns null (never a guess, never NaN) when there is no usable rate", () => {
    expect(conv.toHome(1000, "XYZ")).toBeNull();
    expect(makeConverter("INR", null).toHome(1000, "USD")).toBeNull();
    expect(makeConverter("INR", { ...RATES, rates: { USD: 0 } }).toHome(1000, "USD")).toBeNull();
    expect(makeConverter("INR", { ...RATES, rates: { USD: -1 } }).toHome(1000, "USD")).toBeNull();
    expect(makeConverter("INR", { ...RATES, rates: { USD: NaN } }).toHome(1000, "USD")).toBeNull();
    expect(conv.toHome(NaN, "USD")).toBeNull();
    expect(conv.toHome(Infinity, "INR")).toBeNull();
  });

  it("home-currency amounts still work with no rates at all", () => {
    expect(makeConverter("INR", null).toHome(500, "INR")).toBe(500);
  });
});

describe("yen (no sub-unit)", () => {
  it("only whole yen are legal amounts", () => {
    expect(storedUnitFor("JPY")).toBe(100);
    expect(isLegalAmount(100000, "JPY")).toBe(true);
    expect(isLegalAmount(100050, "JPY")).toBe(false);
    expect(isLegalAmount(100050, "INR")).toBe(true);
    expect(isLegalAmount(1.5, "INR")).toBe(false);
  });

  it("converting INTO yen yields whole yen", () => {
    const toYen = makeConverter("JPY", { base: "JPY", date: "d", rates: { INR: 0.55, USD: 0.0067 } });
    for (const amount of [1, 99, 12345, 999999]) {
      expect((toYen.toHome(amount, "INR") as number) % 100).toBe(0);
      expect((toYen.toHome(amount, "USD") as number) % 100).toBe(0);
    }
  });

  it("converting FROM yen: ¥1,000 is about ₹555 (the stored-unit scale cancels out)", () => {
    expect(conv.toHome(100000, "JPY")).toBe(Math.round(100000 / 1.8)); // ₹555.56 → 55556 stored units
  });
});

describe("sumInHome", () => {
  it("adds converted amounts and marks the result approximate", () => {
    const t = sumInHome([{ amount: 10000, currency: "INR" }, { amount: 1000, currency: "USD" }], conv);
    expect(t).toMatchObject({ currency: "INR", total: 90000, approximate: true, complete: true, skipped: [], date: "2026-10-01" });
  });

  it("is exact and NOT approximate when everything is already in the home currency", () => {
    const t = sumInHome([{ amount: 10000, currency: "INR" }, { amount: 5, currency: "INR" }], conv);
    expect(t).toMatchObject({ total: 10005, approximate: false, complete: true, date: "" });
  });

  it("reports amounts it can't convert, per currency, instead of dropping or adding them raw", () => {
    const t = sumInHome([{ amount: 100, currency: "INR" }, { amount: 7, currency: "XYZ" }, { amount: 3, currency: "XYZ" }, { amount: 50, currency: "ABC" }], conv);
    expect(t.total).toBe(100);
    expect(t.complete).toBe(false);
    expect(t.skipped).toEqual([{ currency: "XYZ", amount: 10 }, { currency: "ABC", amount: 50 }]);
  });

  it("with no rates available, only home money is totalled and the rest is reported", () => {
    const t = sumInHome([{ amount: 100, currency: "INR" }, { amount: 5, currency: "USD" }], makeConverter("INR", null));
    expect(t).toMatchObject({ total: 100, approximate: false, complete: false, skipped: [{ currency: "USD", amount: 5 }] });
  });

  it("zero-amount foreign entries don't make a total 'approximate'", () => {
    expect(sumInHome([{ amount: 100, currency: "INR" }, { amount: 0, currency: "USD" }], conv).approximate).toBe(false);
  });

  it("handles an empty list", () => {
    expect(sumInHome([], conv)).toMatchObject({ total: 0, approximate: false, complete: true });
  });

  it("fuzz: never NaN/negative-from-positive, and splitting a pile of money into parts never changes the total by more than rounding", () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const items = Array.from({ length: 1 + Math.floor(r() * 12) }, () => ({
        amount: Math.floor(r() * 5_000_000),
        currency: CURRENCY_CODES[Math.floor(r() * CURRENCY_CODES.length)] as string,
      }));
      const whole = sumInHome(items, conv);
      expect(Number.isFinite(whole.total)).toBe(true);
      expect(whole.total).toBeGreaterThanOrEqual(0);
      expect(whole.complete).toBe(true);
      // the same money added in two halves differs only by per-item rounding (≤ 0.5 unit per converted item)
      const mid = Math.floor(items.length / 2);
      const parts = sumInHome(items.slice(0, mid), conv).total + sumInHome(items.slice(mid), conv).total;
      expect(parts).toBe(whole.total); // identical: each item is converted independently
    }
  });

  it("fuzz: converting then converting back loses at most a unit or two (rates are consistent)", () => {
    const toUsd = makeConverter("USD", { base: "USD", date: "d", rates: { INR: 80 } });
    const toInr = makeConverter("INR", { base: "INR", date: "d", rates: { USD: 1 / 80 } });
    const r = rng(8);
    for (let i = 0; i < 1000; i++) {
      const inr = 100 + Math.floor(r() * 50_000_000);
      const back = toInr.toHome(toUsd.toHome(inr, "INR") as number, "USD") as number;
      expect(Math.abs(back - inr)).toBeLessThanOrEqual(80); // one stored unit of USD = 80 stored units of INR
    }
  });
});

describe("convertToBase", () => {
  it("stays null for unknown or broken rates", () => {
    expect(convertToBase(100, "USD", { base: "INR", date: "", rates: {} })).toBeNull();
    expect(convertToBase(100, "USD", { base: "INR", date: "", rates: { USD: 0 } })).toBeNull();
  });
});

describe("getRates resilience", () => {
  beforeEach(() => resetRatesCache());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("drops zero, negative and non-numeric rates from the service's answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: "d", rates: { USD: 0.0125, EUR: 0, GBP: -1, CAD: "x", JPY: null } }) }));
    const r = await getRates("INR");
    expect(r?.rates).toEqual({ USD: 0.0125 });
  });

  it("an answer with no usable rates counts as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 0 } }) }));
    expect(await getRates("INR")).toBeNull();
  });

  it("when the service goes down, yesterday's rates are used instead of none", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const f = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ date: "2026-10-01", rates: { USD: 0.0125 } }) });
    vi.stubGlobal("fetch", f);
    const first = await getRates("INR");
    expect(first?.rates.USD).toBe(0.0125);
    vi.setSystemTime(new Date(Date.now() + 7 * 3600 * 1000)); // cache expired (6h)
    f.mockRejectedValue(new Error("service down"));
    const second = await getRates("INR");
    expect(second?.rates.USD).toBe(0.0125); // stale, but far better than nothing
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("with no cached rates and the service down, it is null (and callers must cope)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await getRates("INR")).toBeNull();
  });
});

describe("reportTotals (the printable report)", () => {
  const ME = "me", OTHER = "o";
  const e = (over = {}) => ({ amount: 0, currency: "INR", paidById: ME, splits: [], ...over });

  it("adds what you paid and your share in the home currency, across currencies", () => {
    const t = reportTotals([
      e({ amount: 10000, currency: "INR", paidById: ME, splits: [{ userId: ME, amount: 5000 }, { userId: OTHER, amount: 5000 }] }),
      e({ amount: 2000, currency: "USD", paidById: OTHER, splits: [{ userId: ME, amount: 1000 }, { userId: OTHER, amount: 1000 }] }),
    ], ME, conv);
    expect(t.paid).toMatchObject({ total: 10000, approximate: false }); // you paid only the rupee one
    expect(t.share).toMatchObject({ total: 5000 + 80000, approximate: true }); // ₹50 + $10 (=₹800)
  });

  it("counts your part of a multi-payer expense, not the primary payer's whole bill", () => {
    const t = reportTotals([e({ amount: 9000, paidById: OTHER, payers: [{ userId: OTHER, amount: 6000 }, { userId: ME, amount: 3000 }], splits: [{ userId: ME, amount: 4500 }, { userId: OTHER, amount: 4500 }] })], ME, conv);
    expect(t.paid.total).toBe(3000);
    expect(t.share.total).toBe(4500);
  });

  it("flags currencies it couldn't convert", () => {
    const t = reportTotals([e({ amount: 100, currency: "XYZ", paidById: ME, splits: [{ userId: ME, amount: 100 }] })], ME, conv);
    expect(t.paid.skipped).toEqual([{ currency: "XYZ", amount: 100 }]);
    expect(t.paid.complete).toBe(false);
  });
});
