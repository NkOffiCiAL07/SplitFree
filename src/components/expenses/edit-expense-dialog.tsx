"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateExpense } from "@/hooks/use-expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import type { Expense } from "@/types";

const CATEGORIES = ["FOOD","TRANSPORT","ACCOMMODATION","ENTERTAINMENT","UTILITIES","SHOPPING","HEALTH","TRAVEL","EDUCATION","OTHER"] as const;
const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const schema = z.object({
  description: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  category: z.enum(CATEGORIES),
  date: z.string(),
  notes: z.string().optional(),
  isRecurring: z.boolean(),
  recurringInterval: z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  expense: Expense;
  open: boolean;
  onClose: () => void;
}

export function EditExpenseDialog({ expense, open, onClose }: Props) {
  const updateExpense = useUpdateExpense();

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const isRecurring = watch("isRecurring");

  useEffect(() => {
    if (open) {
      reset({
        description: expense.description,
        amount: (expense.amount / 100).toFixed(2),
        category: expense.category,
        date: format(new Date(expense.date), "yyyy-MM-dd"),
        notes: expense.notes ?? "",
        isRecurring: expense.isRecurring,
        recurringInterval: (expense.recurringInterval as any) ?? undefined,
      });
    }
  }, [open, expense, reset]);

  const onSubmit = async (values: FormValues) => {
    await updateExpense.mutateAsync({
      id: expense.id,
      description: values.description,
      amount: parseFloat(values.amount),
      category: values.category,
      date: new Date(values.date),
      notes: values.notes || undefined,
      isRecurring: values.isRecurring,
      recurringInterval: values.recurringInterval,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} autoFocus />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_EMOJI[c]} {c.charAt(0) + c.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" {...register("date")} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Add a note…" />
          </div>

          <div className="flex items-center justify-between">
            <Label>Recurring</Label>
            <Controller
              name="isRecurring"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {isRecurring && (
            <Controller
              name="recurringInterval"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select interval" /></SelectTrigger>
                  <SelectContent>
                    {["DAILY","WEEKLY","MONTHLY","YEARLY"].map((v) => (
                      <SelectItem key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" className="flex-1" loading={updateExpense.isPending}>Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
