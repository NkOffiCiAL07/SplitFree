import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { restoreQueryCache, saveQueryCache, clearQueryCache, startQueryPersistence, CACHE_VERSION } from "@/lib/offline/persist";
import { idbGet, idbSet } from "@/lib/offline/idb";

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(async () => { await clearQueryCache(); });

describe("query cache persistence", () => {
  it("saves successful queries of known data types and restores them for the same user", async () => {
    const a = client();
    a.setQueryData(["groups"], [{ id: "g1" }]);
    a.setQueryData(["dashboard"], { stats: 1 });
    await saveQueryCache(a, "u1");

    const b = client();
    expect(await restoreQueryCache(b, "u1")).toBe(true);
    expect(b.getQueryData(["groups"])).toEqual([{ id: "g1" }]);
    expect(b.getQueryData(["dashboard"])).toEqual({ stats: 1 });
  });

  it("never persists unknown keys or failed queries", async () => {
    const a = client();
    a.setQueryData(["secret-thing"], "x");
    await a.fetchQuery({ queryKey: ["friends"], queryFn: () => Promise.reject(new Error("boom")) }).catch(() => {});
    await saveQueryCache(a, "u1");
    const b = client();
    await restoreQueryCache(b, "u1");
    expect(b.getQueryData(["secret-thing"])).toBeUndefined();
    expect(b.getQueryData(["friends"])).toBeUndefined();
  });

  it("refuses (and deletes) another user's snapshot", async () => {
    const a = client();
    a.setQueryData(["groups"], [{ id: "g1" }]);
    await saveQueryCache(a, "u1");
    const b = client();
    expect(await restoreQueryCache(b, "u2")).toBe(false);
    expect(b.getQueryData(["groups"])).toBeUndefined();
    expect(await idbGet("query-cache")).toBeUndefined();
  });

  it("ignores snapshots of an old format or older than a week", async () => {
    await idbSet("query-cache", { version: CACHE_VERSION + 1, userId: "u1", savedAt: Date.now(), state: { queries: [], mutations: [] } });
    expect(await restoreQueryCache(client(), "u1")).toBe(false);
    await idbSet("query-cache", { version: CACHE_VERSION, userId: "u1", savedAt: Date.now() - 8 * 86400_000, state: { queries: [], mutations: [] } });
    expect(await restoreQueryCache(client(), "u1")).toBe(false);
  });

  it("clearQueryCache removes the snapshot (sign-out)", async () => {
    const a = client();
    a.setQueryData(["groups"], []);
    await saveQueryCache(a, "u1");
    await clearQueryCache();
    expect(await restoreQueryCache(client(), "u1")).toBe(false);
  });

  it("startQueryPersistence restores, then saves changes after a short debounce, and stops when asked", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const seed = client();
      seed.setQueryData(["balances"], { byPerson: {} });
      await saveQueryCache(seed, "u1");

      const qc = client();
      const stop = await startQueryPersistence(qc, "u1");
      expect(qc.getQueryData(["balances"])).toEqual({ byPerson: {} });

      qc.setQueryData(["friends"], [{ id: "f1" }]);
      await vi.advanceTimersByTimeAsync(1100);
      const fresh = client();
      await restoreQueryCache(fresh, "u1");
      expect(fresh.getQueryData(["friends"])).toEqual([{ id: "f1" }]);

      stop();
      qc.setQueryData(["activity"], [1]);
      await vi.advanceTimersByTimeAsync(1100);
      const after = client();
      await restoreQueryCache(after, "u1");
      expect(after.getQueryData(["activity"])).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
