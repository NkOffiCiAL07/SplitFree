import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { getRates, convertToBase, resetRatesCache } from "@/lib/rates";

beforeEach(() => resetRatesCache());
afterEach(() => vi.unstubAllGlobals());

const mockFetch = (impl: () => Promise<unknown>) => vi.stubGlobal("fetch", vi.fn(impl));

describe("getRates", () => {
  it("returns rates for the requested base and asks only for the other currencies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ base: "INR", date: "2026-10-01", rates: { USD: 0.012, EUR: 0.011 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await getRates("INR");
    expect(r).toEqual({ base: "INR", date: "2026-10-01", rates: { USD: 0.012, EUR: 0.011 } });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("base=INR");
    expect(url).not.toMatch(/symbols=[^&]*INR/);
  });

  it("returns null on HTTP errors, bad payloads and network failures", async () => {
    mockFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await getRates("INR")).toBeNull();
    mockFetch(async () => ({ ok: true, json: async () => ({ nope: 1 }) }));
    expect(await getRates("INR")).toBeNull();
    mockFetch(async () => { throw new Error("offline"); });
    expect(await getRates("INR")).toBeNull();
  });
});

describe("convertToBase", () => {
  const r = { base: "INR", date: "", rates: { USD: 0.0125, EUR: 0.0111 } };
  it("converts into the base currency (1 USD = 80 INR)", () => {
    expect(convertToBase(1000, "USD", r)).toBe(80000); // $10.00 → ₹800.00
  });
  it("returns the amount unchanged for the base currency", () => {
    expect(convertToBase(5000, "INR", r)).toBe(5000);
  });
  it("returns null when the rate is unknown or invalid", () => {
    expect(convertToBase(1000, "GBP", r)).toBeNull();
    expect(convertToBase(1000, "USD", { ...r, rates: { USD: 0 } })).toBeNull();
  });
  it("keeps the sign for negative amounts", () => {
    expect(convertToBase(-1000, "USD", r)).toBe(-80000);
  });
});

describe("getRates caching (so most requests never touch the network)", () => {
  const ok = (rates = { USD: 0.0125 }) => ({ ok: true, json: async () => ({ date: "2026-10-01", rates }) });

  it("serves repeated requests from memory", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    const a = await getRates("INR");
    const b = await getRates("INR");
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a separate entry per base currency", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await getRates("INR");
    await getRates("USD");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers share one in-flight request", async () => {
    let resolve!: (v: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    const all = Promise.all([getRates("INR"), getRates("INR"), getRates("INR")]);
    resolve(ok());
    const results = await all;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.rates.USD === 0.0125)).toBe(true);
  });

  it("does not cache failures — the next request tries again", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect(await getRates("INR")).toBeNull();
    expect(await getRates("INR")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expires after six hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await getRates("INR");
    vi.setSystemTime(Date.now() + 5.9 * 3600_000);
    await getRates("INR");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 0.2 * 3600_000);
    await getRates("INR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  describe("timeoutMs: a slow rate service never holds the caller up", () => {
    it("returns null after the timeout but keeps fetching, so the NEXT request is instant", async () => {
      let resolve!: (v: unknown) => void;
      const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
      vi.stubGlobal("fetch", fetchMock);
      const first = await getRates("INR", { timeoutMs: 20 });
      expect(first).toBeNull(); // gave up waiting…
      resolve(ok()); // …but the fetch finishes in the background
      await new Promise((r) => setTimeout(r, 10));
      const second = await getRates("INR", { timeoutMs: 20 });
      expect(second?.rates.USD).toBe(0.0125);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns the rates normally when they arrive in time", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
      expect((await getRates("INR", { timeoutMs: 500 }))?.rates.USD).toBe(0.0125);
    });
  });
});
