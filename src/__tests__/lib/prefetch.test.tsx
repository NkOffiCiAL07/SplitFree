import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { prefetchForPath } from "@/lib/prefetch";
import { usePrefetchOnIntent } from "@/hooks/use-prefetch";
import { useGroups } from "@/hooks/use-groups";
import { useBalances } from "@/hooks/use-balances";
import { useFriends, usePendingFriendRequests, useSentFriendRequests, useFriendContacts } from "@/hooks/use-friends";
import { useSettlements, useBalance } from "@/hooks/use-settlements";
import { useInfiniteExpenses } from "@/hooks/use-expenses";

const urls = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => ({ data: url.includes("paged=true") ? { items: [{ id: "e1" }], nextCursor: null } : [{ id: "x" }] }),
  })));
});

describe("prefetchForPath — what each page needs", () => {
  it.each([
    ["/dashboard", ["/api/dashboard"]],
    ["/groups", ["/api/groups", "/api/balances"]],
    ["/friends", ["/api/friends", "/api/friends?pending=true", "/api/friends?sent=true", "/api/groups", "/api/balances"]],
    ["/settle", ["/api/settlements?", "/api/balance", "/api/friends?contacts=true"]],
    ["/activity", ["/api/activity"]],
    ["/analytics", ["/api/analytics"]],
  ])("%s", async (path, expected) => {
    const qc = newClient();
    prefetchForPath(qc, path);
    await waitFor(() => expect(urls().sort()).toEqual([...expected].sort()));
  });

  it("expenses prefetches the first page of the default list", async () => {
    const qc = newClient();
    prefetchForPath(qc, "/expenses");
    await waitFor(() => expect(urls()).toEqual(["/api/expenses?paged=true"]));
  });

  it("sub-pages and query strings map to their section (/groups/abc → groups)", async () => {
    const qc = newClient();
    prefetchForPath(qc, "/groups/abc?tab=1");
    await waitFor(() => expect(urls().sort()).toEqual(["/api/balances", "/api/groups"]));
  });

  it("ignores pages with nothing to prefetch", () => {
    prefetchForPath(newClient(), "/settings");
    prefetchForPath(newClient(), "/profile");
    prefetchForPath(newClient(), "/");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("doesn't refetch data that is still fresh (hovering repeatedly is free)", async () => {
    const qc = newClient();
    prefetchForPath(qc, "/groups");
    await waitFor(() => expect(urls()).toHaveLength(2));
    prefetchForPath(qc, "/groups");
    prefetchForPath(qc, "/groups");
    await new Promise((r) => setTimeout(r, 20));
    expect(urls()).toHaveLength(2);
  });

  it("swallows failures (the page will just fetch normally)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => prefetchForPath(newClient(), "/dashboard")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});

describe("prefetched data is exactly what the page's own hooks read (same cache keys)", () => {
  const wrap = (qc: QueryClient) => {
    const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    Wrapper.displayName = "TestQueryWrapper";
    return Wrapper;
  };

  async function expectNoRefetch(path: string, hooks: (() => unknown)[]) {
    const qc = newClient();
    prefetchForPath(qc, path);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    const before = urls().length;
    for (const hook of hooks) renderHook(hook as () => unknown, { wrapper: wrap(qc) });
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().length).toBe(before); // the hooks found the data already in the cache
  }

  it("groups page", () => expectNoRefetch("/groups", [() => useGroups(), () => useBalances()]));
  it("friends page", () => expectNoRefetch("/friends", [() => useFriends(), () => usePendingFriendRequests(), () => useSentFriendRequests(), () => useGroups(), () => useBalances()]));
  it("settle page", () => expectNoRefetch("/settle", [() => useSettlements(), () => useBalance(), () => useFriendContacts()]));
  it("expenses page", () => expectNoRefetch("/expenses", [() => useInfiniteExpenses({ q: "", category: "ALL", from: "", to: "" })]));
});

describe("usePrefetchOnIntent", () => {
  it("returns hover, focus and touch handlers that prefetch that link", async () => {
    const qc = newClient();
    const { result } = renderHook(() => usePrefetchOnIntent(), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    const props = result.current("/activity");
    expect(Object.keys(props).sort()).toEqual(["onFocus", "onMouseEnter", "onTouchStart"]);
    props.onMouseEnter();
    await waitFor(() => expect(urls()).toEqual(["/api/activity"]));
  });
});
