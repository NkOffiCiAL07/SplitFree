"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Receipt, Trash2, Download, Search, X, ChevronRight, Pencil, Copy, FileText } from "lucide-react";
import { useExpenses, useDeleteExpense, useDuplicateExpense } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { useUserCurrency } from "@/hooks/use-profile";
import type { Expense } from "@/types";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const CATEGORIES = ["ALL", "FOOD", "TRANSPORT", "ACCOMMODATION", "ENTERTAINMENT", "UTILITIES", "SHOPPING", "HEALTH", "TRAVEL", "EDUCATION", "OTHER"] as const;

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const { user } = useAuth();
  const deleteMutation = useDeleteExpense();
  const duplicateMutation = useDuplicateExpense();
  const userCurrency = useUserCurrency();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => {
      const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.paidBy?.name?.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "ALL" || e.category === category;
      return matchSearch && matchCat;
    });
  }, [expenses, search, category]);

  const handleExportCSV = () => {
    window.location.href = "/api/export";
  };

  const handleExportPDF = () => {
    window.open("/print/expenses", "_blank");
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Expenses</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} of {expenses?.length ?? 0}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="size-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportPDF}>
              <FileText className="size-3.5" /> PDF
            </Button>
          </div>
          <AddExpenseDialog />
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "ALL" ? "All categories" : CATEGORY_EMOJI[c] + " " + c.charAt(0) + c.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={expenses?.length === 0 ? "No expenses yet" : "No results"}
          description={expenses?.length === 0 ? "Add your first expense to start tracking shared costs." : "Try a different search or filter."}
          action={expenses?.length === 0 ? { label: "Add first expense", onClick: () => {} } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((expense, i) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              userId={user?.id ?? ""}
              index={i}
              onDelete={() => deleteMutation.mutate(expense.id)}
              canDelete={expense.paidById === user?.id}
              onClick={() => setSelectedExpense(expense)}
              userCurrency={userCurrency}
            />
          ))}
        </div>
      )}

      {/* Expense detail modal */}
      <Dialog open={!!selectedExpense} onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{CATEGORY_EMOJI[selectedExpense?.category ?? "OTHER"]}</span>
              <span className="truncate">{selectedExpense?.description}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4 mt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total amount</span>
                <span className="font-bold text-lg">{formatCurrency(selectedExpense.amount, selectedExpense.group?.currency ?? userCurrency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Paid by</span>
                <span className="font-medium">{selectedExpense.paidBy?.name ?? "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span>{formatDate(selectedExpense.date)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span>{selectedExpense.category.charAt(0) + selectedExpense.category.slice(1).toLowerCase()}</span>
              </div>
              {selectedExpense.group && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Group</span>
                  <span>{selectedExpense.group.name}</span>
                </div>
              )}
              {selectedExpense.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{selectedExpense.notes}</p>
                </div>
              )}
              {selectedExpense.splits && selectedExpense.splits.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Split between</span>
                  <div className="space-y-1.5">
                    {selectedExpense.splits.map((split) => (
                      <div key={split.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40">
                        <Avatar className="size-6 shrink-0">
                          <AvatarImage src={split.user?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">{getInitials(split.user?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">{split.user?.name ?? split.userId}</span>
                        <span className={cn("text-sm font-semibold", split.userId === user?.id ? "text-primary" : "")}>
                          {formatCurrency(split.amount, selectedExpense.group?.currency ?? userCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    duplicateMutation.mutate(selectedExpense);
                    setSelectedExpense(null);
                  }}
                  loading={duplicateMutation.isPending}
                >
                  <Copy className="size-3.5" /> Duplicate
                </Button>
                {selectedExpense.paidById === user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => { setEditingExpense(selectedExpense); setSelectedExpense(null); }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                )}
                {selectedExpense.paidById === user?.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { deleteMutation.mutate(selectedExpense.id); setSelectedExpense(null); }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit expense dialog */}
      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}

function ExpenseRow({
  expense, userId, index, onDelete, canDelete, onClick, userCurrency,
}: {
  expense: Expense; userId: string; index: number;
  onDelete: () => void; canDelete: boolean; onClick: () => void; userCurrency: string;
}) {
  const myShare = expense.splits?.find((s) => s.userId === userId);
  const isPayer = expense.paidById === userId;
  const displayCurrency = expense.group?.currency ?? userCurrency;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-all group cursor-pointer"
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
        <p className="text-sm font-semibold">{formatCurrency(expense.amount, displayCurrency)}</p>
        {myShare && (
          <p className={cn("text-xs", isPayer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {isPayer ? "you paid" : `you owe ${formatCurrency(myShare.amount, displayCurrency)}`}
          </p>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </motion.div>
  );
}
