"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface MonthlyPoint { month: string; owed: number; owing: number }
interface Props { data?: MonthlyPoint[]; isLoading?: boolean; currency?: string }

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name === "owed" ? "Owed to you" : "You owe"}:</span>
          <span className="font-semibold ml-auto">{formatCurrency(p.value * 100, currency ?? "USD")}</span>
        </div>
      ))}
    </div>
  );
}

export function BalanceChart({ data = [], isLoading, currency = "USD" }: Props) {
  const isEmpty = !isLoading && data.every((d) => d.owed === 0 && d.owing === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
      className="h-full"
    >
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base">Balance Overview</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Money flow over the last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />Owed to you
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />You owe
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-[220px] w-full rounded-lg" />
          ) : isEmpty ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              Add expenses to see your balance trend
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-owed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-owing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrency(v * 100, currency)}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Area type="monotone" dataKey="owed" name="owed" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#grad-owed)" dot={false} activeDot={{ r: 4, fill: "#8b5cf6" }} />
                <Area type="monotone" dataKey="owing" name="owing" stroke="#ef4444" strokeWidth={2.5} fill="url(#grad-owing)" dot={false} activeDot={{ r: 4, fill: "#ef4444" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
