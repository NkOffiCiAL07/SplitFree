"use client";

import { useMemo, useState } from "react";
import { m } from "framer-motion";
import { RefreshCw, Trash2, Calendar } from "lucide-react";
import { useInfiniteExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { monthlyByCurrency } from "@/lib/recurring";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useUserCurrency } from "@/hooks/use-profile";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const INTERVAL_LABEL: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export default function RecurringPage() {
  // Server-side filter: finds every recurring expense, not just those among the latest 50
  const { expenses, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteExpenses({ recurring: true, limit: 100 });
  const { user } = useAuth();
  const deleteMutation = useDeleteExpense();
  const userCurrency = useUserCurrency();
  const [addOpen, setAddOpen] = useState(false);

  const recurring = useMemo(() => expenses.filter((e) => e.isRecurring), [expenses]);

  // Per-currency estimate: rupees and dollars are never added together
  const monthly = useMemo(() => monthlyByCurrency(recurring), [recurring]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Recurring</h2>
          <p className="text-sm text-muted-foreground">{recurring.length} active subscriptions</p>
        </div>
        <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} />
      </div>

      {/* Monthly summary banner */}
      {recurring.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 gradient-brand text-white"
        >
          <p className="text-sm text-white/80">Estimated monthly cost</p>
          <p className="text-3xl font-bold mt-1">{monthly.map((m2) => formatCurrency(m2.amount, m2.currency)).join(" + ")}</p>
          <p className="text-sm text-white/70 mt-1">across {recurring.length} recurring {recurring.length === 1 ? "expense" : "expenses"}</p>
        </m.div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : recurring.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No recurring expenses"
          description="Mark an expense as recurring when adding it to track subscriptions and bills."
          action={{ label: "Add recurring expense", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {recurring.map((expense, i) => {
            const currency = expense.currency ?? userCurrency; // the expense's own currency
            const isPayer = expense.paidById === user?.id;
            return (
              <m.div
                key={expense.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i < 12 ? i * 0.04 : 0, duration: 0.25 }}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                  {CATEGORY_EMOJI[expense.category] ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{expense.description}</p>
                    {expense.recurringInterval && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {INTERVAL_LABEL[expense.recurringInterval] ?? expense.recurringInterval}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="size-3" />
                    Since {formatDate(expense.date)}
                    {expense.group && <span> · {expense.group.name}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(expense.amount, currency)}</p>
                  <p className={cn("text-xs", isPayer ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                    {isPayer ? "you pay" : `paid by ${expense.paidBy?.name?.split(" ")[0]}`}
                  </p>
                </div>
                {isPayer && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      if (confirm("Stop this recurring expense?")) {
                        deleteMutation.mutate(expense);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </m.div>
            );
          })}
          {hasNextPage && (
            <Button variant="outline" className="w-full" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
