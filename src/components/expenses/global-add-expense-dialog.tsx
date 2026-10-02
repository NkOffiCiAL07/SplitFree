"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";

// The dialog (form, validation, split logic) is large — only fetch it once it's first opened.
const AddExpenseDialog = dynamic(
  () => import("./add-expense-dialog").then((m) => m.AddExpenseDialog),
  { ssr: false }
);

export function GlobalAddExpenseDialog() {
  const { addExpenseOpen, setAddExpenseOpen } = useUIStore();
  const [everOpened, setEverOpened] = useState(false);
  if (addExpenseOpen && !everOpened) setEverOpened(true);

  if (!everOpened) return null;
  return (
    <AddExpenseDialog
      open={addExpenseOpen}
      onOpenChange={setAddExpenseOpen}
    />
  );
}
