"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChartProps<T> { data: T[]; currency: string }

export function MonthlyBarChart({ data: monthlyData, currency }: ChartProps<{ name: string; total: number }>) {
  return (
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
  );
}

export function CategoryPieChart({ data: categoryData, currency }: ChartProps<{ name: string; value: number; color: string }>) {
  return (
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
  );
}
