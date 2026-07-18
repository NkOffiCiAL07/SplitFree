"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DebtSummary } from "@/components/dashboard/debt-summary";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatCompactCurrency, cn } from "@/lib/utils";

async function fetchDashboard() {
  const res = await fetch("/api/dashboard");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30_000,
  });

  const currency = data?.currency ?? "USD";
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
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-xl font-bold">
          {getTimeOfDay()}, {firstName} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s your financial snapshot.</p>
      </motion.div>

      {/* Onboarding */}
      <OnboardingBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : stats.map((stat, i) => <StatCard key={stat.title} {...stat} index={i} />)
        }
      </div>

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
