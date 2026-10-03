import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => "INR" }));
vi.mock("@/components/charts", () => ({
  MonthlyBarChart: ({ currency }: { currency: string }) => <div data-testid="bar" data-currency={currency} />,
  CategoryPieChart: ({ currency }: { currency: string }) => <div data-testid="pie" data-currency={currency} />,
  BalanceChart: () => <div />,
}));
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<unknown>) => {
      // resolve the dynamic chart components from the mocked module
      function Lazy(props: Record<string, unknown>) {
        const [C, setC] = React.useState<null | ((p: Record<string, unknown>) => React.ReactNode)>(null);
        React.useEffect(() => {
          let cancelled = false; // don't update state after the test (and its environment) is gone
          (loader() as Promise<(p: Record<string, unknown>) => React.ReactNode>).then((c) => { if (!cancelled) setC(() => c); });
          return () => { cancelled = true; };
        }, []);
        return C ? C(props) : null;
      }
      return Lazy;
    },
  };
});

import AnalyticsPage from "@/app/(dashboard)/analytics/page";

const payload = (over = {}) => ({
  monthly: [{ month: "2026-10", total: 180000, byCategory: { FOOD: 100000, TRAVEL: 80000 } }],
  categoryTotals: { FOOD: 100000, TRAVEL: 80000 }, totalExpenses: 180000, totalOwed: 90000, totalOwing: 0, groupCount: 2,
  currency: "INR", approximate: false, rateDate: "", skipped: [], ...over,
});

function mount(data: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data }) })));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AnalyticsPage /></QueryClientProvider>);
}
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());

describe("AnalyticsPage — mixed currencies", () => {
  it("shows the totals in the home currency with no note when nothing was converted", async () => {
    mount(payload());
    expect(await screen.findByText("₹1.8K")).toBeInTheDocument();
    expect(screen.queryByTestId("conversion-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("skipped-note")).not.toBeInTheDocument();
  });

  it("says converted amounts are approximate, naming the home currency and the rate date", async () => {
    mount(payload({ approximate: true, rateDate: "2026-10-01" }));
    const note = await screen.findByTestId("conversion-note");
    expect(note).toHaveTextContent("≈");
    expect(note).toHaveTextContent("INR");
    expect(note).toHaveTextContent("2026-10-01");
  });

  it("lists spending that couldn't be converted (no rate) instead of hiding it", async () => {
    mount(payload({ skipped: [{ currency: "USD", amount: 2000 }, { currency: "EUR", amount: 500 }] }));
    const note = await screen.findByTestId("skipped-note");
    expect(note).toHaveTextContent(/no exchange rate/i);
    expect(note).toHaveTextContent("$20.00");
    expect(note).toHaveTextContent("€5.00");
  });

  it("charts are given the home currency the API reports", async () => {
    mount(payload({ currency: "USD" }));
    expect((await screen.findByTestId("bar"))).toHaveAttribute("data-currency", "USD");
  });
});
