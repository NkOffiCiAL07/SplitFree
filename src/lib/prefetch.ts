import type { QueryClient } from "@tanstack/react-query";
import { infiniteExpensesOptions } from "@/hooks/use-expenses";

const FRESH_FOR_MS = 30_000;

async function fetchData(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

/** [queryKey, url] pairs each page needs on arrival — keys MUST match what the page's own hooks use. */
const NEEDS: Record<string, [unknown[], string][]> = {
  "/dashboard": [[["dashboard"], "/api/dashboard"]],
  "/groups": [[["groups"], "/api/groups"], [["balances"], "/api/balances"]],
  "/friends": [
    [["friends"], "/api/friends"], [["friends", "pending"], "/api/friends?pending=true"],
    [["friends", "sent"], "/api/friends?sent=true"], [["groups"], "/api/groups"], [["balances"], "/api/balances"],
  ],
  "/settle": [[["settlements", "all"], "/api/settlements?"], [["balance"], "/api/balance"], [["friends", "contacts"], "/api/friends?contacts=true"]],
  "/activity": [[["activity"], "/api/activity"]],
  "/analytics": [[["analytics"], "/api/analytics"]],
};

/**
 * Starts loading a page's data before the user gets there (call on hover / focus / touch of its link),
 * so the page renders with data instead of skeletons. Safe to call repeatedly: data fresher than 30s is
 * reused, and failures are ignored (the page will simply fetch normally).
 */
export function prefetchForPath(qc: QueryClient, href: string) {
  const path = "/" + href.split("?")[0].split("/").filter(Boolean)[0];
  if (path === "/expenses") {
    void qc.prefetchInfiniteQuery({
      ...infiniteExpensesOptions({ q: "", category: "ALL", from: "", to: "" }),
      pages: 1,
      staleTime: FRESH_FOR_MS,
    }).catch(() => {});
    return;
  }
  for (const [queryKey, url] of NEEDS[path] ?? []) {
    void qc.prefetchQuery({ queryKey, queryFn: () => fetchData(url), staleTime: FRESH_FOR_MS }).catch(() => {});
  }
}
