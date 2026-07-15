"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useUserCurrency } from "@/hooks/use-profile";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  FOOD:"#8b5cf6", TRANSPORT:"#3b82f6", ACCOMMODATION:"#10b981",
  ENTERTAINMENT:"#f59e0b", UTILITIES:"#ef4444", SHOPPING:"#ec4899",
  HEALTH:"#06b6d4", TRAVEL:"#84cc16", EDUCATION:"#a855f7", OTHER:"#6b7280",
};

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔", TRANSPORT:"🚗", ACCOMMODATION:"🏨", ENTERTAINMENT:"🎭",
  UTILITIES:"💡", SHOPPING:"🛒", HEALTH:"💊", TRAVEL:"✈️", EDUCATION:"📚", OTHER:"📦",
};

async function fetchAnalytics() {
  const res = await fetch("/api/analytics");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics, staleTime: 60_000 });
  const currency = useUserCurrency();

  const monthlyData = data?.monthly?.map((m: any) => ({
    name: format(new Date(m.month + "-01"), "MMM"),
    total: m.total / 100,
  })) ?? [];

  const categoryData = data?.categoryTotals
    ? Object.entries(data.categoryTotals)
        .map(([cat, amt]) => ({
          cat,
          name: cat.charAt(0) + cat.slice(1).toLowerCase(),
          value: (amt as number) / 100,
          cents: amt as number,
          color: CATEGORY_COLORS[cat] ?? "#6b7280",
        }))
        .sort((a, b) => b.cents - a.cents)
    : [];

  const totalCents = categoryData.reduce((s, c) => s + c.cents, 0);

  const stats = [
    { label: "Total spent", value: formatCurrency(data?.totalExpenses ?? 0, currency) },
    { label: "Owed to you", value: formatCurrency(data?.totalOwed ?? 0, currency), positive: true },
    { label: "You owe", value: formatCurrency(data?.totalOwing ?? 0, currency), negative: true },
    { label: "Groups", value: String(data?.groupCount ?? 0) },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Last 6 months overview</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : stats.map(({ label, value, positive, negative }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${positive ? "text-green-600 dark:text-green-400" : negative ? "text-red-600 dark:text-red-400" : ""}`}>
                    {value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly bar chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monthly Spending</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? <Skeleton className="h-52 w-full rounded-lg" /> : (
                monthlyData.every((d: any) => d.total === 0) ? (
                  <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => formatCurrency(v * 100, currency)}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(v) => [formatCurrency(Number(v) * 100, currency), "Total"]}
                      />
                      <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Category pie chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? <Skeleton className="h-52 w-full rounded-lg" /> : categoryData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v) * 100, currency), "Amount"]}
                      contentStyle={{ borderRadius: "0.75rem", fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Category breakdown list */}
      {categoryData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)
                : categoryData.map((c, i) => {
                    const pct = totalCents > 0 ? (c.cents / totalCents) * 100 : 0;
                    return (
                      <motion.div
                        key={c.cat}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.38 + i * 0.04 }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span>{CATEGORY_EMOJI[c.cat]}</span>
                            <span className="font-medium">{c.name}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                            <span className="font-semibold w-24 text-right">{formatCurrency(c.cents, currency)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.4 + i * 0.04, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
