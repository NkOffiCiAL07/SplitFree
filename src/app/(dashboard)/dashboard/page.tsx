"use client";

import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { useQuery } from "@tanstack/react-query";
import { m } from "framer-motion";
import { TrendingUp, TrendingDown, Users, Wallet, Plus, ArrowLeftRight } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DebtSummary } from "@/components/dashboard/debt-summary";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/stores/ui-store";
import { formatCompactCurrency } from "@/lib/utils";
import Link from "next/link";
import dynamic from "next/dynamic";

// Recharts is ~350KB — load it after first paint instead of blocking the dashboard
const BalanceChart = dynamic(
  () => import("@/components/dashboard/balance-chart").then((m) => m.BalanceChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-xl" /> }
);

async function fetchDashboard() {
  const res = await fetch("/api/dashboard");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";
  const { setAddExpenseOpen } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30_000,
  });

  const currency = data?.currency ?? DEFAULT_CURRENCY;
  const netBalance = data?.stats?.netBalance ?? 0;

  const stats = [
    {
      title: "Owed to You",
      value: isLoading ? "—" : formatCompactCurrency(data?.stats?.totalOwed ?? 0, currency),
      sub: "others owe you",
      icon: TrendingUp,
      variant: "green" as const,
    },
    {
      title: "You Owe",
      value: isLoading ? "—" : formatCompactCurrency(data?.stats?.totalOwing ?? 0, currency),
      sub: "settle up soon",
      icon: TrendingDown,
      variant: "red" as const,
    },
    {
      title: "Active Groups",
      value: isLoading ? "—" : String(data?.stats?.groupCount ?? 0),
      sub: "shared groups",
      icon: Users,
      variant: "amber" as const,
    },
    {
      title: "Net Balance",
      value: isLoading ? "—" : formatCompactCurrency(netBalance, currency),
      sub: netBalance >= 0 ? "you're ahead" : "you're behind",
      icon: Wallet,
      variant: netBalance >= 0 ? "violet" as const : "red" as const,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Greeting + Quick actions */}
      <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <h2 className="text-xl font-bold">
            {getTimeOfDay()}, {firstName} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s your financial snapshot.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="brand" size="sm" className="gap-1.5" onClick={() => setAddExpenseOpen(true)}>
            <Plus className="size-4" /> Add expense
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" asChild>
            <Link href="/settle">
              <ArrowLeftRight className="size-4" /> Settle up
            </Link>
          </Button>
        </div>
      </m.div>

      {/* Onboarding */}
      <OnboardingBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : stats.map((stat, i) => <StatCard key={stat.title} {...stat} index={i} />)
        }
      </div>

      {/* Balances in other currencies are kept separate, never converted or summed */}
      {!isLoading && data?.stats?.otherCurrencies?.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Also in other currencies:{" "}
          {data.stats.otherCurrencies
            .map((c: { currency: string; owed: number; owing: number }) =>
              [
                c.owed > 0 ? `owed ${formatCompactCurrency(c.owed, c.currency)}` : null,
                c.owing > 0 ? `owe ${formatCompactCurrency(c.owing, c.currency)}` : null,
              ].filter(Boolean).join(", ")
            )
            .join(" · ")}
          {data.stats.combined && (
            <span title={`Live exchange rates as of ${data.stats.combined.date}`}>
              {" "}— ≈ {formatCompactCurrency(Math.abs(data.stats.combined.net), currency)}{" "}
              {data.stats.combined.net >= 0 ? "in your favour" : "to pay"} overall (approx.)
            </span>
          )}
        </p>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BalanceChart data={data?.monthly} isLoading={isLoading} currency={currency} />
        </div>
        <div>
          <DebtSummary
            balances={data?.personBalances}
            netBalance={netBalance}
            currency={currency}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Recent activity */}
      <RecentActivity activities={data?.recentActivity} currency={currency} isLoading={isLoading} />
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
