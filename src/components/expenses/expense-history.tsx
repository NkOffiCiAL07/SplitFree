"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useExpenseHistory } from "@/hooks/use-expenses";
import { describeChange } from "@/lib/revisions";
import { formatRelativeTime } from "@/lib/utils";

/** Collapsible "Edit history" list for one expense (loads only when opened). */
export function ExpenseHistory({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useExpenseHistory(expenseId, open);

  return (
    <div className="space-y-2" data-testid="expense-history">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="size-3.5" /> Edit history
      </button>

      {open && (
        <div className="space-y-2 text-xs">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-destructive">Couldn&apos;t load the history.</p>
          ) : !data || data.revisions.length === 0 ? (
            <p className="text-muted-foreground">No edits yet.</p>
          ) : (
            data.revisions.map((r) => {
              const nameOf = (id: string) => data.people[id] ?? "Someone";
              return (
                <div key={r.id} className="rounded-lg border p-2 space-y-0.5">
                  <p className="font-medium">
                    {nameOf(r.editorId)} <span className="font-normal text-muted-foreground">· {formatRelativeTime(r.createdAt)}</span>
                  </p>
                  {Object.entries(r.changes).map(([field, change]) => (
                    <p key={field} className="text-muted-foreground">{describeChange(field, change, nameOf, data.currency)}</p>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
