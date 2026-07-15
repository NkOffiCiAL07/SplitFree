"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  variant?: "green" | "red" | "amber" | "violet" | "blue";
  index?: number;
}

const variantStyles = {
  green:  { icon: "bg-green-500/10 text-green-600 dark:text-green-400",  bar: "bg-green-500",  text: "text-green-600 dark:text-green-400" },
  red:    { icon: "bg-red-500/10 text-red-600 dark:text-red-400",        bar: "bg-red-500",    text: "text-red-600 dark:text-red-400" },
  amber:  { icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",  bar: "bg-amber-500",  text: "text-amber-600 dark:text-amber-400" },
  violet: { icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  blue:   { icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",     bar: "bg-blue-500",   text: "text-blue-600 dark:text-blue-400" },
};

export function StatCard({ title, value, sub, icon: Icon, variant = "violet", index = 0 }: StatCardProps) {
  const styles = variantStyles[variant];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
        <div className={cn("absolute top-0 left-0 right-0 h-0.5", styles.bar)} />
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
              <p className={cn("text-xl md:text-2xl font-bold mt-1 truncate", styles.text)}>{value}</p>
              {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            <div className={cn("w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0", styles.icon)}>
              <Icon className="size-4 md:size-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
