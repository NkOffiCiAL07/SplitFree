import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render, act } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

const auth = vi.hoisted(() => {
  const state = { listener: null as null | ((event: string, session: unknown) => void), unsubscribe: vi.fn() };
  return { state, onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => { state.listener = cb; return { data: { subscription: { unsubscribe: state.unsubscribe } } }; }) };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { onAuthStateChange: auth.onAuthStateChange } }) }));

import { QueryProvider } from "@/components/shared/query-provider";

let client: QueryClient;
// Hands the provider's QueryClient to the test (assigned in an effect, not during render)
function Probe({ onClient }: { onClient: (c: QueryClient) => void }) {
  const qc = useQueryClient();
  useEffect(() => { onClient(qc); }, [qc, onClient]);
  return null;
}
const capture = (c: QueryClient) => { client = c; };
const mount = () => render(<QueryProvider><Probe onClient={capture} /></QueryProvider>);
const session = (id: string) => ({ user: { id } });
const emit = (event: string, s: unknown) => act(() => auth.state.listener!(event, s));
const seed = () => { client.setQueryData(["friends"], ["asha"]); client.setQueryData(["groups"], ["goa"]); };

// Fake Cache Storage so we can check the service-worker API cache purge
const cacheStore = new Map<string, Map<string, boolean>>();
function installCaches() {
  vi.stubGlobal("caches", {
    keys: async () => [...cacheStore.keys()],
    open: async (name: string) => ({
      keys: async () => [...cacheStore.get(name)!.keys()].map((u) => ({ url: u })),
      delete: async (req: { url: string }) => cacheStore.get(name)!.delete(req.url),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cacheStore.clear();
  cacheStore.set("splitfree-v6", new Map([["https://app/api/friends", true], ["https://app/dashboard", true], ["https://app/api/groups", true]]));
  installCaches();
});
afterEach(() => vi.unstubAllGlobals());

describe("QueryProvider — never leak one account's data to another", () => {
  it("keeps the cache across the initial session and a normal re-sign-in of the same user", () => {
    mount(); seed();
    emit("INITIAL_SESSION", session("u1"));
    emit("SIGNED_IN", session("u1"));
    emit("TOKEN_REFRESHED", session("u1"));
    expect(client.getQueryData(["friends"])).toEqual(["asha"]);
  });

  it("does not wipe in-flight data on the first sign-in after a signed-out start", () => {
    mount(); seed();
    emit("INITIAL_SESSION", null);
    emit("SIGNED_IN", session("u1")); // null → u1 is a first sign-in, not an account switch
    expect(client.getQueryData(["friends"])).toEqual(["asha"]);
  });

  it("clears every cached query on sign-out", () => {
    mount(); seed();
    emit("INITIAL_SESSION", session("u1"));
    emit("SIGNED_OUT", null);
    expect(client.getQueryData(["friends"])).toBeUndefined();
    expect(client.getQueryData(["groups"])).toBeUndefined();
  });

  it("clears the cache when a different user signs in (account switch in the same tab)", () => {
    mount(); seed();
    emit("INITIAL_SESSION", session("u1"));
    emit("SIGNED_IN", session("u2"));
    expect(client.getQueryData(["friends"])).toBeUndefined();
  });

  it("also purges the service worker's offline copies of API responses — but keeps pages", async () => {
    mount();
    emit("INITIAL_SESSION", session("u1"));
    emit("SIGNED_OUT", null);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect([...cacheStore.get("splitfree-v6")!.keys()]).toEqual(["https://app/dashboard"]);
  });

  it("unsubscribes when unmounted", () => {
    const { unmount } = mount();
    unmount();
    expect(auth.state.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("QueryProvider — offline mode", () => {
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

  it("restores the signed-in user's saved data on start", async () => {
    const { saveQueryCache } = await import("@/lib/offline/persist");
    const { QueryClient } = await import("@tanstack/react-query");
    const saved = new QueryClient();
    saved.setQueryData(["groups"], ["goa"]);
    await saveQueryCache(saved, "u1");

    mount();
    emit("INITIAL_SESSION", session("u1"));
    await flush();
    expect(client.getQueryData(["groups"])).toEqual(["goa"]);
  });

  it("never restores another user's saved data", async () => {
    const { saveQueryCache } = await import("@/lib/offline/persist");
    const { QueryClient } = await import("@tanstack/react-query");
    const saved = new QueryClient();
    saved.setQueryData(["groups"], ["goa"]);
    await saveQueryCache(saved, "someone-else");

    mount();
    emit("INITIAL_SESSION", session("u1"));
    await flush();
    expect(client.getQueryData(["groups"])).toBeUndefined();
  });

  it("sign-out wipes the device copy and any unsent offline writes", async () => {
    const { enqueue, pendingItems } = await import("@/lib/offline/outbox");
    const { restoreQueryCache, saveQueryCache } = await import("@/lib/offline/persist");
    const { QueryClient } = await import("@tanstack/react-query");
    mount();
    emit("INITIAL_SESSION", session("u1"));
    enqueue({ id: "a", kind: "expense", url: "/api/expenses", body: {}, label: "Dinner", amount: 1, currency: "INR" });
    expect(pendingItems()).toHaveLength(1);
    const saved = new QueryClient();
    saved.setQueryData(["groups"], ["goa"]);
    await saveQueryCache(saved, "u1");

    emit("SIGNED_OUT", null);
    await flush();
    expect(pendingItems()).toEqual([]);
    expect(await restoreQueryCache(new QueryClient(), "u1")).toBe(false);
  });

  it("an account switch doesn't let the new user see or send the old user's queued writes", async () => {
    const { enqueue, pendingItems } = await import("@/lib/offline/outbox");
    mount();
    emit("INITIAL_SESSION", session("u1"));
    enqueue({ id: "a", kind: "expense", url: "/api/expenses", body: {}, label: "Dinner", amount: 1, currency: "INR" });
    emit("SIGNED_IN", session("u2"));
    expect(pendingItems()).toEqual([]);
  });

  it("lets writes run while offline so they can be queued (networkMode: always)", () => {
    mount();
    expect(client.getDefaultOptions().mutations?.networkMode).toBe("always");
  });
});
