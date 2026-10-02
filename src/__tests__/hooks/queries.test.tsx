import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createHarness, stubFetch, callOf } from "./harness";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useGroups, useGroup } from "@/hooks/use-groups";
import { useBalances } from "@/hooks/use-balances";
import { useComments } from "@/hooks/use-comments";
import { useGroupBudget } from "@/hooks/use-budget";
import { useFriends, useFriendContacts, usePendingFriendRequests, useSentFriendRequests, useFriendDetail } from "@/hooks/use-friends";
import { useSettlements, useBalance, useGroupDebts } from "@/hooks/use-settlements";
import { useProfile, useUserCurrency } from "@/hooks/use-profile";
import { useExpenses, useExpense, useExpenseHistory, useInfiniteExpenses } from "@/hooks/use-expenses";

beforeEach(() => vi.clearAllMocks());

const run = async <T,>(hook: () => T, reply: unknown = []) => {
  const fetchMock = stubFetch({ data: reply });
  const { wrapper } = createHarness();
  const view = renderHook(hook, { wrapper });
  return { fetchMock, view };
};

describe.each([
  ["useGroups", () => useGroups(), "/api/groups"],
  ["useGroups(archived)", () => useGroups(true), "/api/groups?archived=true"],
  ["useGroup", () => useGroup("g1"), "/api/groups/g1"],
  ["useBalances", () => useBalances(), "/api/balances"],
  ["useComments", () => useComments("e1"), "/api/expenses/e1/comments"],
  ["useGroupBudget", () => useGroupBudget("g1"), "/api/groups/g1/budget"],
  ["useFriends", () => useFriends(), "/api/friends"],
  ["useFriendContacts", () => useFriendContacts(), "/api/friends?contacts=true"],
  ["usePendingFriendRequests", () => usePendingFriendRequests(), "/api/friends?pending=true"],
  ["useSentFriendRequests", () => useSentFriendRequests(), "/api/friends?sent=true"],
  ["useFriendDetail", () => useFriendDetail("u2"), "/api/friends/u2"],
  ["useSettlements", () => useSettlements(), "/api/settlements?"],
  ["useSettlements(group)", () => useSettlements("g1"), "/api/settlements?groupId=g1"],
  ["useBalance", () => useBalance(), "/api/balance"],
  ["useGroupDebts", () => useGroupDebts("g1"), "/api/settlements?groupId=g1&simplified=true"],
  ["useProfile", () => useProfile(), "/api/profile"],
  ["useExpenses", () => useExpenses(), "/api/expenses"],
  ["useExpenses(group)", () => useExpenses("g1"), "/api/expenses?groupId=g1"],
  ["useExpense", () => useExpense("e1"), "/api/expenses/e1"],
  ["useExpenseHistory", () => useExpenseHistory("e1"), "/api/expenses/e1/history"],
])("%s", (_name, hook, url) => {
  it(`GETs ${url} and returns the data`, async () => {
    const { fetchMock, view } = await run(hook as () => { data?: unknown }, [{ id: "x" }]);
    await waitFor(() => expect((view.result.current as { data?: unknown }).data).toEqual([{ id: "x" }]));
    expect(callOf(fetchMock)).toEqual({ url, method: "GET", body: undefined });
  });

  it("exposes the server's error message", async () => {
    stubFetch({ error: { message: "Boom" } });
    const { wrapper } = createHarness();
    const view = renderHook(hook as () => { error?: Error | null }, { wrapper });
    await waitFor(() => expect((view.result.current as { error?: Error | null }).error?.message).toBe("Boom"));
  });
});

describe("queries that wait for an id", () => {
  it.each([
    ["useGroup", () => useGroup("")],
    ["useComments", () => useComments("")],
    ["useGroupBudget", () => useGroupBudget("")],
    ["useFriendDetail", () => useFriendDetail("")],
    ["useGroupDebts", () => useGroupDebts("")],
    ["useExpense", () => useExpense("")],
    ["useExpenseHistory", () => useExpenseHistory("")],
  ])("%s doesn't fetch without an id", async (_n, hook) => {
    const { fetchMock } = await run(hook as () => unknown);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("useExpenseHistory stays idle until enabled (collapsed history costs nothing)", async () => {
    const { fetchMock } = await run(() => useExpenseHistory("e1", false));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useUserCurrency", () => {
  it("reads the dashboard currency from the shared cache", async () => {
    const { view } = await run(() => useUserCurrency(), { currency: "USD" });
    await waitFor(() => expect(view.result.current).toBe("USD"));
  });

  it("defaults to INR before data arrives or when the dashboard has no currency", async () => {
    const { view } = await run(() => useUserCurrency(), {});
    expect(view.result.current).toBe("INR");
    await waitFor(() => expect(view.result.current).toBe("INR"));
  });
});

describe("useInfiniteExpenses", () => {
  it("pages with the cursor from the previous page and flattens the results", async () => {
    const fetchMock = stubFetch((url) => {
      const cursor = new URL(url, "http://x").searchParams.get("cursor");
      return cursor ? { data: { items: [{ id: "c" }], nextCursor: null } } : { data: { items: [{ id: "a" }, { id: "b" }], nextCursor: "b" } };
    });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInfiniteExpenses({ q: "goa", category: "FOOD" }), { wrapper });

    await waitFor(() => expect(result.current.expenses.map((e) => e.id)).toEqual(["a", "b"]));
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("q=goa");
    expect(fetchMock.mock.calls[0][0]).toContain("category=FOOD");
    expect(fetchMock.mock.calls[0][0]).not.toContain("cursor");

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.expenses.map((e) => e.id)).toEqual(["a", "b", "c"]));
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=b");
    expect(result.current.hasNextPage).toBe(false);
  });

  it("starts empty while loading", async () => {
    stubFetch({ data: { items: [], nextCursor: null } });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInfiniteExpenses(), { wrapper });
    expect(result.current.expenses).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
