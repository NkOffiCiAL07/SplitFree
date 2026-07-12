"use client";

import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Receipt, Users,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DebtSummary } from "@/components/dashboard/debt-summary";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { useAuth } from "@/hooks/use-auth";

const stats = [
  {
    title: "Total Owed to You",
    value: "$124.50",
    change: "+$45.00 this month",
    changeType: "positive" as const,
    icon: TrendingUp,
    iconColor: "text-green-600",
  },
  {
    title: "Total You Owe",
    value: "$67.30",
    change: "−$12.00 this month",
    changeType: "positive" as const,
    icon: TrendingDown,
    iconColor: "text-red-600",
  },
  {
    title: "Active Groups",
    value: "4",
    change: "3 expenses this week",
    changeType: "neutral" as const,
    icon: Users,
    iconColor: "text-amber-600",
  },
  {
    title: "Total Expenses",
    value: "$1,240",
    change: "+18% vs last month",
    changeType: "positive" as const,
    icon: Receipt,
    iconColor: "text-primary",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.name?.split(" ")[0] ?? "there";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-bold">
          Good {getTimeOfDay()}, {firstName} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here&apos;s an overview of your expenses and balances.
        </p>
      </motion.div>

      {/* Onboarding */}
      <OnboardingBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Chart — 2 cols */}
        <div className="lg:col-span-2">
          <BalanceChart />
        </div>

        {/* Debt summary */}
        <div>
          <DebtSummary />
        </div>
      </div>

      {/* Recent activity */}
      <RecentActivity />
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
