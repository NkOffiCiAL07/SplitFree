"use client";

import { useUIStore } from "@/stores/ui-store";
import { AddExpenseDialog } from "./add-expense-dialog";

export function GlobalAddExpenseDialog() {
  const { addExpenseOpen, setAddExpenseOpen } = useUIStore();
  return (
    <AddExpenseDialog
      open={addExpenseOpen}
      onOpenChange={setAddExpenseOpen}
    />
  );
}
