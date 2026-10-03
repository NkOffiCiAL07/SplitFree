"use client";

import { Clock } from "lucide-react";
import { useOutbox } from "@/hooks/use-outbox";
import { formatCurrency } from "@/lib/utils";

/** Expenses and payments saved offline that haven't reached the server yet. */
export function PendingSyncList() {
  const pending = useOutbox();
  if (pending.length === 0) return null;
  return (
    <section aria-label="Waiting to sync" className="rounded-xl border border-dashed border-amber-400/70 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <Clock className="size-3.5" /> Waiting to sync ({pending.length})
      </p>
      <ul className="space-y-1.5">
        {pending.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">
              {item.label}
              <span className="ml-2 text-xs text-muted-foreground">{item.kind === "settlement" ? "payment" : "expense"}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium">{formatCurrency(Math.round(item.amount * 100), item.currency)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
