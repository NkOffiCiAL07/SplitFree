import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";

// recharts needs real layout; swap it for lightweight stand-ins that expose what we pass in
vi.mock("recharts", () => {
  const passthrough = (name: string) => {
    const Stub = ({ children, ...p }: { children?: React.ReactNode }) => <div data-testid={name} data-props={JSON.stringify(Object.keys(p))}>{children}</div>;
    Stub.displayName = `Stub(${name})`;
    return Stub;
  };
  const YAxis = ({ tickFormatter, width }: { tickFormatter?: (v: number) => string; width?: number }) => (
    <div data-testid="yaxis" data-width={width}>{[0, 500, 10000, 150000].map((v) => <span key={v}>{tickFormatter?.(v)}</span>)}</div>
  );
  return {
    ResponsiveContainer: passthrough("responsive"), AreaChart: passthrough("area-chart"), BarChart: passthrough("bar-chart"), PieChart: passthrough("pie-chart"),
    Area: passthrough("area"), Bar: passthrough("bar"), Pie: passthrough("pie"), Cell: passthrough("cell"), XAxis: passthrough("xaxis"),
    CartesianGrid: passthrough("grid"), Tooltip: passthrough("tooltip"), YAxis,
  };
});

import { StatCard } from "@/components/dashboard/stat-card";
import { DebtSummary } from "@/components/dashboard/debt-summary";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { MonthlyBarChart, CategoryPieChart } from "@/components/analytics/analytics-charts";

describe("StatCard", () => {
  it("shows title, value and the optional subtitle", () => {
    render(<StatCard title="Owed to You" value="₹499.99" sub="others owe you" icon={TrendingUp} variant="green" />);
    expect(screen.getByText("Owed to You")).toBeInTheDocument();
    expect(screen.getByText("₹499.99")).toHaveClass("text-green-600");
    expect(screen.getByText("others owe you")).toBeInTheDocument();
  });
  it("omits the subtitle when not given and defaults to the violet style", () => {
    render(<StatCard title="Groups" value="3" icon={TrendingUp} />);
    expect(screen.getByText("3")).toHaveClass("text-violet-600");
    expect(screen.queryByText("shared groups")).not.toBeInTheDocument();
  });
});

describe("DebtSummary", () => {
  const people = [
    { id: "a", name: "Asha Rao", avatarUrl: null, net: 49999, currency: "INR" },
    { id: "b", name: "Bhanu Pal", avatarUrl: null, net: -990000, currency: "INR" },
    { id: "c", name: "Chris", avatarUrl: null, net: -2000, currency: "USD" },
  ];

  it("shows skeletons while loading", () => {
    render(<DebtSummary isLoading />);
    expect(screen.queryByText(/no outstanding balances/i)).not.toBeInTheDocument();
  });

  it("says there is nothing outstanding when there are no balances", () => {
    render(<DebtSummary balances={[]} />);
    expect(screen.getByText(/no outstanding balances/i)).toBeInTheDocument();
  });

  it("headline: 'You're owed' (green) when net is positive", () => {
    render(<DebtSummary balances={people.slice(0, 1)} netBalance={49999} currency="INR" />);
    expect(screen.getByText("You're owed ₹499.99")).toBeInTheDocument();
  });

  it("headline: 'You owe' when net is negative", () => {
    render(<DebtSummary balances={people} netBalance={-940001} currency="INR" />);
    expect(screen.getByText("You owe ₹9,400.01")).toBeInTheDocument();
  });

  it("lists each person with direction and amount in THEIR currency (not the headline's)", () => {
    render(<DebtSummary balances={people} netBalance={-1} currency="INR" />);
    expect(screen.getByText("owes you")).toBeInTheDocument();
    expect(screen.getAllByText("you owe")).toHaveLength(2);
    expect(screen.getByText("₹499.99")).toHaveClass("text-green-600");
    expect(screen.getByText("₹9,900.00")).toHaveClass("text-red-600"); // Indian grouping, red = you owe
    expect(screen.getByText("$20.00")).toHaveClass("text-red-600"); // a USD debt stays in dollars
    expect(document.body.textContent).not.toMatch(/[−+-]\s?[$₹]/); // no minus sign: colour + "you owe" say it
  });

  it("each person is a link to their page, where the balance can be settled", () => {
    render(<DebtSummary balances={people} netBalance={-1} currency="INR" />);
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("/friends/"));
    expect(links).toHaveLength(people.length);
    for (const [i, p] of people.entries()) {
      expect(links[i]).toHaveAttribute("href", `/friends/${p.id}`);
      expect(links[i]).toHaveAccessibleName(new RegExp(`${p.name}.*Open to settle up`));
    }
  });

  it("links to Settle up", () => {
    render(<DebtSummary balances={[]} />);
    expect(screen.getByRole("link", { name: /settle up/i })).toHaveAttribute("href", "/settle");
  });
});

describe("RecentActivity", () => {
  const item = (over: object) => ({ id: Math.random().toString(), type: "EXPENSE_CREATED", metadata: {}, user: { name: "Asha", avatarUrl: null }, createdAt: new Date().toISOString(), ...over });

  it("describes each activity type in plain words", () => {
    render(<RecentActivity activities={[
      item({ type: "EXPENSE_CREATED", metadata: { description: "Dinner", amount: 50000 } }),
      item({ type: "EXPENSE_UPDATED", metadata: { description: "Cab" } }),
      item({ type: "EXPENSE_DELETED", metadata: { description: "Snacks" } }),
      item({ type: "SETTLEMENT_CREATED", metadata: { amount: 10000 } }),
      item({ type: "GROUP_CREATED", metadata: { groupName: "Goa" } }),
      item({ type: "MEMBER_ADDED", metadata: { groupName: "Goa" } }),
      item({ type: "MEMBER_REMOVED", metadata: {} }),
    ] as never} />);
    for (const text of ["Asha added Dinner", "Asha updated Cab", "Asha deleted Snacks", "Asha recorded a payment", "Asha created group Goa", "Asha joined Goa", "Asha left a group"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("falls back gracefully for missing metadata and unknown types", () => {
    render(<RecentActivity activities={[item({ type: "EXPENSE_CREATED", metadata: null }), item({ type: "WEIRD" })] as never} />);
    expect(screen.getByText("Asha added an expense")).toBeInTheDocument();
    expect(screen.getByText("Activity recorded")).toBeInTheDocument();
  });

  it("prints every amount in ITS OWN currency, whatever the home currency is", () => {
    render(<RecentActivity currency="INR" activities={[
      item({ type: "EXPENSE_CREATED", metadata: { description: "Hotel", amount: 5000, currency: "USD" } }),
      item({ type: "SETTLEMENT_CREATED", metadata: { amount: 70000, currency: "EUR" } }),
      item({ type: "EXPENSE_CREATED", metadata: { description: "Chai", amount: 5000, currency: "INR" } }),
    ] as never} />);
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("€700.00")).toBeInTheDocument();
    expect(screen.getByText("₹50.00")).toBeInTheDocument();
  });

  it("hides an amount whose currency is unknown instead of guessing one", () => {
    render(<RecentActivity currency="INR" activities={[item({ type: "EXPENSE_CREATED", metadata: { description: "Old", amount: 5000 } })] as never} />);
    expect(screen.getByText("Asha added Old")).toBeInTheDocument();
    expect(screen.queryByText(/50\.00/)).not.toBeInTheDocument();
  });

  it("links to the full feed", () => {
    render(<RecentActivity activities={[]} />);
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute("href", "/activity");
  });
});

describe("BalanceChart", () => {
  const data = [{ month: "Jan", owed: 100, owing: 50 }, { month: "Feb", owed: 0, owing: 0 }];

  it("shows a skeleton while loading", () => {
    render(<BalanceChart isLoading />);
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("explains an empty chart instead of drawing flat lines", () => {
    render(<BalanceChart data={[{ month: "Jan", owed: 0, owing: 0 }]} />);
    expect(screen.getByText(/add expenses to see your balance trend/i)).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("draws both series and uses compact axis labels that fit (₹10.0K, not clipped '00.00')", () => {
    render(<BalanceChart data={data} currency="INR" />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("area")).toHaveLength(2);
    expect(screen.getByTestId("yaxis")).toHaveAttribute("data-width", "52");
    const labels = screen.getByTestId("yaxis").textContent!;
    expect(labels).toContain("₹500");
    expect(labels).toContain("₹10.0K");
    expect(labels).toContain("₹1.5L");
    expect(labels).not.toContain("00.00");
  });
});

describe("analytics charts", () => {
  it("monthly bar chart uses compact axis labels in the user's currency", () => {
    render(<MonthlyBarChart data={[{ name: "Jan", total: 1000 }]} currency="USD" />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("yaxis").textContent).toContain("$10.0K");
  });
  it("category pie chart draws one slice per category", () => {
    render(<CategoryPieChart currency="INR" data={[{ name: "Food", value: 10, color: "#111" }, { name: "Travel", value: 5, color: "#222" }]} />);
    expect(screen.getAllByTestId("cell")).toHaveLength(2);
  });
});
