"use client";

import { useState } from "react";
import { TrendingUp, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useGroupBudget, useSetBudget, useDeleteBudget } from "@/hooks/use-budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const CATEGORIES = ["FOOD","TRANSPORT","ACCOMMODATION","ENTERTAINMENT","UTILITIES","SHOPPING","HEALTH","TRAVEL","EDUCATION","OTHER"] as const;

export function BudgetCard({ groupId, currency }: { groupId: string; currency: string }) {
  const { data } = useGroupBudget(groupId);
  const setBudget = useSetBudget(groupId);
  const deleteBudget = useDeleteBudget(groupId);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("__all__");
  const [period, setPeriod] = useState("MONTHLY");

  const budgets: any[] = data?.budgets ?? [];
  const totalSpent: number = data?.totalSpentThisMonth ?? 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    await setBudget.mutateAsync({
      amount: parseFloat(amount),
      category: category === "__all__" ? null : category,
      period,
    });
    setOpen(false);
    setAmount("");
    setCategory("__all__");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Budget</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <Plus className="size-3" /> Set budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Set budget</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Monthly limit ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category (optional)</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_EMOJI[c]} {c.charAt(0) + c.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" variant="brand" loading={setBudget.isPending}>
                Save budget
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No budgets set. Add one to track your spending.
        </p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b: any) => {
            const limitDollars = b.amount;
            const spentDollars = b.category ? 0 : totalSpent;
            const pct = limitDollars > 0 ? Math.min((spentDollars / limitDollars) * 100, 100) : 0;
            const isOver = spentDollars > limitDollars;
            const isWarning = pct >= 80 && !isOver;

            return (
              <div key={b.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {b.category ? (
                      <span className="text-base">{CATEGORY_EMOJI[b.category] ?? "📦"}</span>
                    ) : (
                      <TrendingUp className="size-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-xs font-medium">
                        {b.category ? b.category.charAt(0) + b.category.slice(1).toLowerCase() : "Total"}
                        <span className="text-muted-foreground ml-1 font-normal">({b.period.toLowerCase()})</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(isOver || isWarning) && (
                      <AlertTriangle className={cn("size-3.5", isOver ? "text-destructive" : "text-amber-500")} />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(spentDollars, currency)} / {formatCurrency(limitDollars, currency)}
                    </span>
                    <button
                      onClick={() => deleteBudget.mutate(b.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isOver ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={cn("text-[10px]", isOver ? "text-destructive" : "text-muted-foreground")}>
                  {isOver
                    ? `Over budget by ${formatCurrency(spentDollars - limitDollars, currency)}`
                    : `${formatCurrency(limitDollars - spentDollars, currency)} remaining (${Math.round(pct)}% used)`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
