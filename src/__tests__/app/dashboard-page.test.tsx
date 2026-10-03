import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createHarness } from "../hooks/harness";

const h = vi.hoisted(() => ({ setAddExpenseOpen: vi.fn(), user: { value: { id: "me", email: "nishant@x.com", user_metadata: { name: "Nishant Kumar" } } as unknown } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: h.user.value }) }));
vi.mock("@/stores/ui-store", () => ({ useUIStore: () => ({ setAddExpenseOpen: h.setAddExpenseOpen }) }));
vi.mock("next/dynamic", () => ({ default: () => ({ data, currency }: { data?: unknown[]; currency?: string }) => <div data-testid="balance-chart" data-points={data?.length} data-currency={currency} /> }));
vi.mock("@/components/dashboard/onboarding-banner", () => ({ OnboardingBanner: () => null }));
vi.mock("@/components/dashboard/recent-activity", () => ({ RecentActivity: ({ activities }: { activities?: unknown[] }) => <div data-testid="recent" data-count={activities?.length} /> }));

import DashboardPage from "@/app/(dashboard)/dashboard/page";

const data = (over: Record<string, unknown> = {}, stats: Record<string, unknown> = {}) => ({
  currency: "INR",
  stats: { totalOwed: 49999, totalOwing: 990000, groupCount: 3, netBalance: -940001, otherCurrencies: [], combined: null, ...stats },
  monthly: [{ month: "Oct", owed: 1, owing: 2 }],
  personBalances: [], recentActivity: [{ id: "a" }], ...over,
});

function mount(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => (ok ? { data: payload } : { error: { message: "boom" } }) }));
  vi.stubGlobal("fetch", fetchMock);
  const { wrapper } = createHarness();
  render(<DashboardPage />, { wrapper });
  return fetchMock;
}

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); h.user.value = { id: "me", email: "nishant@x.com", user_metadata: { name: "Nishant Kumar" } }; });
afterEach(() => vi.useRealTimers());

describe("DashboardPage", () => {
  it("greets by first name according to the time of day", async () => {
    for (const [hour, word] of [[8, "Good morning"], [14, "Good afternoon"], [20, "Good evening"]] as const) {
      vi.setSystemTime(new Date(2026, 9, 2, hour, 0));
      mount(data());
      expect(await screen.findByText(new RegExp(`${word}, Nishant`))).toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });

  it("falls back to the email name, then 'there'", async () => {
    h.user.value = { id: "me", email: "priya.k@x.com", user_metadata: {} };
    mount(data());
    expect(await screen.findByText(/, priya\.k/)).toBeInTheDocument();
    document.body.innerHTML = "";
    h.user.value = null;
    mount(data());
    expect(await screen.findByText(/, there/)).toBeInTheDocument();
  });

  it("shows the four headline stats in rupees with compact (K/L) formatting", async () => {
    mount(data());
    expect(await screen.findByText("₹499.99")).toBeInTheDocument(); // owed to you
    expect(screen.getByText("₹9.9K")).toBeInTheDocument(); // you owe
    expect(screen.getByText("3")).toBeInTheDocument(); // groups
    expect(screen.getByText(/₹9\.4K/)).toBeInTheDocument(); // net, negative
    expect(screen.getByText("you're behind")).toBeInTheDocument();
  });

  it("says 'you're ahead' when net is positive", async () => {
    mount(data({}, { totalOwed: 200000, totalOwing: 0, netBalance: 200000 }));
    expect(await screen.findByText("you're ahead")).toBeInTheDocument();
  });

  it("when amounts were converted, says so (≈), with the rate date and the original amounts", async () => {
    mount(data({}, { otherCurrencies: [{ currency: "USD", owed: 0, owing: 20000 }], approximate: true, incomplete: false, rateDate: "2026-10-01" }));
    const note = await screen.findByTestId("currency-note");
    expect(note).toHaveTextContent("≈ Includes converted amounts");
    expect(note).toHaveTextContent("2026-10-01");
    expect(note).toHaveTextContent("owe $200.00");
    expect(note).toHaveTextContent("settle each debt in its own currency");
    expect(screen.getByText("others owe you · ≈")).toBeInTheDocument();
  });

  it("when a rate is missing, says those amounts are NOT in the totals", async () => {
    mount(data({}, { otherCurrencies: [{ currency: "EUR", owed: 5000, owing: 0 }], approximate: false, incomplete: true }));
    const note = await screen.findByTestId("currency-note");
    expect(note).toHaveTextContent(/not included in the totals/i);
    expect(note).toHaveTextContent("owed €50.00");
  });

  it("omits the other-currency note when everything is in one currency", async () => {
    mount(data());
    await screen.findByText("₹499.99");
    expect(screen.queryByTestId("currency-note")).not.toBeInTheDocument();
  });

  it("passes the monthly series and currency to the chart and the activity feed", async () => {
    mount(data());
    await waitFor(() => expect(screen.getByTestId("balance-chart")).toHaveAttribute("data-points", "1"));
    expect(screen.getByTestId("balance-chart")).toHaveAttribute("data-currency", "INR");
    expect(screen.getByTestId("recent")).toHaveAttribute("data-count", "1");
  });

  it("Add expense opens the dialog; Settle up goes to the settle page", async () => {
    mount(data());
    await userEvent.click(await screen.findByRole("button", { name: /add expense/i }));
    expect(h.setAddExpenseOpen).toHaveBeenCalledWith(true);
    for (const link of screen.getAllByRole("link", { name: /settle up/i })) expect(link).toHaveAttribute("href", "/settle");
  });

  it("shows placeholders while loading", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { wrapper } = createHarness();
    render(<DashboardPage />, { wrapper });
    expect(screen.queryByText("Owed to You")).not.toBeInTheDocument(); // stat cards are skeletons until data arrives
    expect(screen.queryByText("₹499.99")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add expense/i })).toBeInTheDocument(); // actions are usable straight away
  });

  it("requests the dashboard API once", async () => {
    const fetchMock = mount(data());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/dashboard"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
