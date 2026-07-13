"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useUserCurrency } from "@/hooks/use-profile";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  FOOD:"#8b5cf6",TRANSPORT:"#3b82f6",ACCOMMODATION:"#10b981",
  ENTERTAINMENT:"#f59e0b",UTILITIES:"#ef4444",SHOPPING:"#ec4899",
  HEALTH:"#06b6d4",TRAVEL:"#84cc16",EDUCATION:"#a855f7",OTHER:"#6b7280",
};

async function fetchAnalytics() {
  const res = await fetch("/api/analytics");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics });
  const currency = useUserCurrency();

  const monthlyData = data?.monthly?.map((m: any) => ({
    name: format(new Date(m.month + "-01"), "MMM"),
    total: m.total / 100,
  })) ?? [];

  const categoryData = data?.categoryTotals
    ? Object.entries(data.categoryTotals).map(([cat, amt]) => ({
        name: cat.charAt(0) + cat.slice(1).toLowerCase(),
        value: (amt as number) / 100,
        color: CATEGORY_COLORS[cat] ?? "#6b7280",
      }))
    : [];

  const stats = [
    { label: "Total spent (6mo)", value: formatCurrency(data?.totalExpenses ?? 0, currency) },
    { label: "Total owed to you", value: formatCurrency(data?.totalOwed ?? 0, currency), positive: true },
    { label: "Total you owe", value: formatCurrency(data?.totalOwing ?? 0, currency), negative: true },
    { label: "Active groups", value: data?.groupCount ?? 0 },
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
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
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
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v * 100, currency)} />
                    <Tooltip
                      contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))", fontSize: 12 }}
                      formatter={(v) => [formatCurrency(Number(v) * 100, currency), "Spending"]}
                    />
                    <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
              {isLoading ? <Skeleton className="h-52 w-full rounded-lg" /> : (
                categoryData.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                          {categoryData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [formatCurrency(Number(v) * 100, currency), "Amount"]} contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
