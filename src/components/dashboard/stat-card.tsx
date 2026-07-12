"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  index?: number;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-primary",
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
    >
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {title}
              </p>
              <p className="text-2xl font-bold mt-1 truncate">{value}</p>
              {change && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-1 text-xs font-medium",
                    changeType === "positive" && "text-green-600 dark:text-green-400",
                    changeType === "negative" && "text-red-600 dark:text-red-400",
                    changeType === "neutral" && "text-muted-foreground"
                  )}
                >
                  {changeType === "positive" && <TrendingUp className="size-3" />}
                  {changeType === "negative" && <TrendingDown className="size-3" />}
                  <span>{change}</span>
                </div>
              )}
            </div>
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 shrink-0",
                iconColor === "text-green-600" && "bg-green-100 dark:bg-green-900/20",
                iconColor === "text-red-600" && "bg-red-100 dark:bg-red-900/20",
                iconColor === "text-amber-600" && "bg-amber-100 dark:bg-amber-900/20"
              )}
            >
              <Icon className={cn("size-5", iconColor)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
