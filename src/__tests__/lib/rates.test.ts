import { describe, it, expect, vi, afterEach } from "vitest";
import { getRates, convertToBase } from "@/lib/rates";

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
