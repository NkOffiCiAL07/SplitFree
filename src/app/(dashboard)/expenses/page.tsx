"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Receipt, Trash2, Download } from "lucide-react";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Expense } from "@/types";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const { user } = useAuth();
  const deleteMutation = useDeleteExpense();

  const handleExport = () => {
    window.location.href = "/api/export";
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Expenses</h2>
          <p className="text-sm text-muted-foreground">{expenses?.length ?? 0} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="size-4" /> Export CSV
          </Button>
          <AddExpenseDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : expenses?.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Add your first expense to start tracking shared costs."
          action={{ label: "Add first expense", onClick: () => {} }}
        />
      ) : (
        <div className="space-y-2">
          {expenses?.map((expense, i) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              userId={user?.id ?? ""}
              index={i}
              onDelete={() => deleteMutation.mutate(expense.id)}
              canDelete={expense.paidById === user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({
  expense, userId, index, onDelete, canDelete,
}: {
  expense: Expense; userId: string; index: number;
  onDelete: () => void; canDelete: boolean;
}) {
  const myShare = expense.splits?.find((s) => s.userId === userId);
  const isPayer = expense.paidById === userId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
        {CATEGORY_EMOJI[expense.category] ?? "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{expense.description}</p>
          {expense.isRecurring && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Recurring</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {expense.paidBy?.name ?? "Unknown"} · {formatDate(expense.date)}
          {expense.group && <span> · {expense.group.name}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatCurrency(expense.amount)}</p>
        {myShare && (
          <p className={cn("text-xs", isPayer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {isPayer ? "you paid" : `you owe ${formatCurrency(myShare.amount)}`}
          </p>
        )}
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </motion.div>
  );
}
