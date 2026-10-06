"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { REACTIONS } from "@/lib/reactions";
import { cn } from "@/lib/utils";

export interface Reaction { emoji: string; count: number; mine: boolean }

/** Small, read-only reactions for an expense row (the first few, with a "+N" for the rest). */
export function ReactionChips({ reactions = [], max = 3 }: { reactions?: Reaction[]; max?: number }) {
  if (reactions.length === 0) return null;
  const shown = reactions.slice(0, max);
  const more = reactions.length - shown.length;
  return (
    <span data-testid="reaction-chips" className="mt-1 flex flex-wrap items-center gap-1">
      {shown.map((r) => (
        <span key={r.emoji} className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[11px] leading-tight", r.mine ? "border-primary/40 bg-primary/10" : "bg-muted/60")}>
          <span aria-hidden="true">{r.emoji}</span>
          <span className="tabular-nums text-muted-foreground">{r.count}</span>
          <span className="sr-only">{r.count} {r.count === 1 ? "reaction" : "reactions"} {r.emoji}</span>
        </span>
      ))}
      {more > 0 && <span className="text-[11px] text-muted-foreground">+{more}</span>}
    </span>
  );
}

/** Tap an emoji to react, tap it again to take it back. Everyone who can see the expense sees it. */
export function ReactionBar({ expenseId, reactions = [] }: { expenseId: string; reactions?: Reaction[] }) {
  const qc = useQueryClient();
  const [list, setList] = useState<Reaction[]>(reactions);
  const [syncedFrom, setSyncedFrom] = useState(reactions);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Follow fresh data from the server (state adjusted during render, not in an effect)
  if (reactions !== syncedFrom) { setSyncedFrom(reactions); setList(reactions); }

  const toggle = async (emoji: string) => {
    if (busy) return;
    const before = list;
    // show the change at once; the server's answer replaces it
    const had = list.find((r) => r.emoji === emoji);
    setList(had
      ? list.flatMap((r) => (r.emoji !== emoji ? [r] : r.count <= 1 ? [] : [{ ...r, count: r.count - (r.mine ? 1 : 0), mine: false }]))
      : [...list, { emoji, count: 1, mine: true }].sort((a, b) => REACTIONS.indexOf(a.emoji as never) - REACTIONS.indexOf(b.emoji as never)));
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}/reactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message ?? "Couldn't save your reaction");
      setList(json.data);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    } catch (e) {
      setList(before);
      toast.error(e instanceof Error ? e.message : "Couldn't save your reaction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="reaction-bar" className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((r) => (
          <button
            key={r.emoji}
            type="button"
            aria-pressed={r.mine}
            aria-label={`${r.emoji} ${r.count}${r.mine ? " — you reacted, tap to undo" : ""}`}
            onClick={() => toggle(r.emoji)}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-all active:scale-95", r.mine ? "border-primary bg-primary/10" : "hover:bg-accent")}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span className="text-xs font-medium tabular-nums">{r.count}</span>
          </button>
        ))}
        <button type="button" aria-expanded={open} aria-label="Add a reaction" onClick={() => setOpen((o) => !o)} className="inline-flex size-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <SmilePlus className="size-4" />
        </button>
      </div>
      {open && (
        <div role="group" aria-label="Choose a reaction" className="flex flex-wrap gap-1 rounded-2xl border bg-card p-1.5 shadow-sm">
          {REACTIONS.map((e) => (
            <button key={e} type="button" aria-label={`React with ${e}`} onClick={() => toggle(e)} className="flex size-9 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110 hover:bg-accent active:scale-95">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
