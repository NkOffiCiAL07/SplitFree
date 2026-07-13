"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Receipt, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DebtSummary } from "@/components/dashboard/debt-summary";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";

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

  const stats = [
    {
      title: "Total Owed to You",
      value: isLoading ? "—" : formatCurrency(data?.stats?.totalOwed ?? 0, currency),
      icon: TrendingUp,
      iconColor: "text-green-600",
    },
    {
      title: "Total You Owe",
      value: isLoading ? "—" : formatCurrency(data?.stats?.totalOwing ?? 0, currency),
      icon: TrendingDown,
      iconColor: "text-red-600",
    },
    {
      title: "Active Groups",
      value: isLoading ? "—" : String(data?.stats?.groupCount ?? 0),
      icon: Users,
      iconColor: "text-amber-600",
    },
    {
      title: "Net Balance",
      value: isLoading ? "—" : formatCurrency(Math.abs(data?.stats?.netBalance ?? 0), currency),
      icon: Receipt,
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-xl font-bold">Good {getTimeOfDay()}, {firstName} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s an overview of your expenses and balances.</p>
      </motion.div>

      {/* Onboarding */}
      <OnboardingBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : stats.map((stat, i) => <StatCard key={stat.title} {...stat} index={i} />)
        }
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2">
          <BalanceChart data={data?.monthly} isLoading={isLoading} />
        </div>
        <div>
          <DebtSummary
            balances={data?.personBalances}
            netBalance={data?.stats?.netBalance}
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
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
