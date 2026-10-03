import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, isNetworkError, OfflineError, BadResponseError } from "@/lib/api-client";

const setOnline = (v: boolean) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("apiFetch", () => {
  it("returns json.data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: { a: 1 }, error: null }) }));
    expect(await apiFetch("/api/x")).toEqual({ a: 1 });
  });

  it("throws the server's message for API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Nope" } }) }));
    await expect(apiFetch("/api/x")).rejects.toThrow("Nope");
  });

  it("fails fast with a friendly OfflineError when the device is offline — without calling fetch", async () => {
    setOnline(false);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(OfflineError);
    expect(f).not.toHaveBeenCalled();
  });

  it("turns a dropped connection (TypeError: Failed to fetch) into an OfflineError", async () => {
    setOnline(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const e = await apiFetch("/api/x").catch((x) => x);
    expect(e).toBeInstanceOf(OfflineError);
    expect(e.message).toMatch(/offline/i);
  });

  it("a non-JSON reply (captive portal, gateway error page) is a BadResponseError, not a raw SyntaxError", async () => {
    setOnline(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => { throw new SyntaxError("Unexpected token <"); } }));
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(BadResponseError);
  });

  it("doesn't disguise other failures", async () => {
    setOnline(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new RangeError("weird")));
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(RangeError);
  });
});

describe("isNetworkError", () => {
  it("recognises network failures only", () => {
    expect(isNetworkError(new OfflineError())).toBe(true);
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new BadResponseError())).toBe(true);
    expect(isNetworkError(new Error("Unauthorized"))).toBe(false);
    expect(isNetworkError("x")).toBe(false);
  });
});
