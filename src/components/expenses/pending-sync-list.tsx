"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { useOutbox } from "@/hooks/use-outbox";
import { removeItem, retryItem } from "@/lib/offline/outbox";
import { formatCurrency } from "@/lib/utils";

/**
 * Expenses and payments saved offline that haven't reached the server yet — and any the server refused. Nothing
 * here is ever dropped silently: refused items stay until the person retries or discards them.
 */
export function PendingSyncList() {
  const queue = useOutbox();
  if (queue.length === 0) return null;
  const waiting = queue.filter((i) => i.status !== "failed");
  const failed = queue.filter((i) => i.status === "failed");
  const money = (amount: number, currency: string) => formatCurrency(Math.round(amount * 100), currency);

  return (
    <div className="space-y-2">
      {waiting.length > 0 && (
        <section aria-label="Waiting to sync" className="rounded-xl border border-dashed border-amber-400/70 bg-amber-50/60 p-3 dark:bg-amber-950/20">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Clock className="size-3.5" /> Waiting to sync ({waiting.length})
          </p>
          <ul className="space-y-1.5">
            {waiting.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  {item.label}
                  <span className="ml-2 text-xs text-muted-foreground">{item.kind === "settlement" ? "payment" : "expense"}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium">{money(item.amount, item.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failed.length > 0 && (
        <section aria-label="Needs attention" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3.5" /> Couldn&apos;t be saved ({failed.length})
          </p>
          <ul className="space-y-2.5">
            {failed.map((item) => (
              <li key={item.id} className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">
                    {item.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{item.kind === "settlement" ? "payment" : "expense"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">{money(item.amount, item.currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.error ?? "The server refused this change."}</p>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => retryItem(item.id)} className="font-medium text-primary hover:underline">Try again</button>
                  <button type="button" onClick={() => removeItem(item.id)} className="font-medium text-destructive hover:underline">Discard</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
