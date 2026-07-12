"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import Link from "next/link";

const DEMO_DEBTS = [
  {
    id: "1",
    type: "owed",
    user: { name: "Alex Chen", avatarUrl: null },
    amount: 4500,
  },
  {
    id: "2",
    type: "owing",
    user: { name: "Sarah Kim", avatarUrl: null },
    amount: 2300,
  },
  {
    id: "3",
    type: "owed",
    user: { name: "James Park", avatarUrl: null },
    amount: 7800,
  },
];

export function DebtSummary() {
  const totalOwed  = DEMO_DEBTS.filter((d) => d.type === "owed").reduce((s, d) => s + d.amount, 0);
  const totalOwing = DEMO_DEBTS.filter((d) => d.type === "owing").reduce((s, d) => s + d.amount, 0);
  const net = totalOwed - totalOwing;

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
          {/* Net balance pill */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold w-fit",
              net >= 0
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            {net >= 0 ? (
              <>
                <CheckCircle2 className="size-4" />
                You&apos;re owed {formatCurrency(Math.abs(net))}
              </>
            ) : (
              <>
                <ArrowRight className="size-4" />
                You owe {formatCurrency(Math.abs(net))}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {DEMO_DEBTS.map((debt, i) => (
            <motion.div
              key={debt.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 + i * 0.07, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <Avatar className="size-8">
                <AvatarImage src={debt.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(debt.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{debt.user.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {debt.type === "owed" ? "owes you" : "you owe"}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  debt.type === "owed"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {debt.type === "owing" && "−"}
                {formatCurrency(debt.amount)}
              </span>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
