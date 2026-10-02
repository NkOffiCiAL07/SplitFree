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
