"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_DATA = [
  { month: "Jan", owed: 240, owing: 120 },
  { month: "Feb", owed: 380, owing: 200 },
  { month: "Mar", owed: 150, owing: 80 },
  { month: "Apr", owed: 490, owing: 310 },
  { month: "May", owed: 320, owing: 150 },
  { month: "Jun", owed: 560, owing: 280 },
  { month: "Jul", owed: 420, owing: 190 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium">${p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BalanceChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Balance Overview</CardTitle>
          <p className="text-xs text-muted-foreground">
            Money owed to you vs. money you owe
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={DEMO_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-owed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-owing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="owed"
                name="owed"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#grad-owed)"
              />
              <Area
                type="monotone"
                dataKey="owing"
                name="owing"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#grad-owing)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Owed to you
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              You owe
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
