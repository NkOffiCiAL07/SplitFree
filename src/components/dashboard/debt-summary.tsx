"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import Link from "next/link";

interface PersonBalance {
  id: string;
  name: string;
  avatarUrl: string | null;
  net: number; // positive = they owe you, negative = you owe them
}

interface Props { balances?: PersonBalance[]; netBalance?: number; currency?: string; isLoading?: boolean }

export function DebtSummary({ balances = [], netBalance = 0, currency = "USD", isLoading }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Balances</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settle" className="text-xs">Settle up</Link>
            </Button>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-36 rounded-xl" />
          ) : (
            <div className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold w-fit",
              netBalance >= 0
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {netBalance >= 0 ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
              {netBalance >= 0
                ? `You're owed ${formatCurrency(Math.abs(netBalance), currency)}`
                : `You owe ${formatCurrency(Math.abs(netBalance), currency)}`}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
          ) : balances.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No outstanding balances</p>
          ) : (
            balances.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.32 + i * 0.07, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <Avatar className="size-8">
                  <AvatarImage src={b.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{getInitials(b.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">{b.net > 0 ? "owes you" : "you owe"}</p>
                </div>
                <span className={cn("text-sm font-semibold",
                  b.net > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {b.net < 0 && "−"}{formatCurrency(Math.abs(b.net), currency)}
                </span>
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
