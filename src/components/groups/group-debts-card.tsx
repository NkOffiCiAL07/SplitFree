"use client";

import { useState } from "react";
import { ArrowRight, Share2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupDebts } from "@/hooks/use-settlements";
import { formatCurrency } from "@/lib/utils";
import { formatSettlePlan } from "@/lib/settle-tools";
import { APP_NAME } from "@/lib/app-config";
import type { SimplifiedDebt } from "@/types";
import { UpiPayLink } from "@/components/shared/upi-pay-link";
import { DebtGraph } from "@/components/groups/debt-graph";

interface Props {
  groupId: string;
  /** userId → display name */
  names: Record<string, string>;
  currentUserId?: string;
  /** userId → saved UPI ID, for one-tap rupee payments */
  upiIds?: Record<string, string | null | undefined>;
  /** Called when the user taps Pay on a debt they owe */
  onPay: (debt: SimplifiedDebt) => void;
}

/** "Simplify group debts": the fewest payments that settle everyone in the group. */
export function GroupDebtsCard({ groupId, names, currentUserId, upiIds = {}, onPay }: Props) {
  const { data, isLoading } = useGroupDebts(groupId);
  const [view, setView] = useState<"list" | "graph">("list");
  const debts = data?.simplified ?? [];
  const label = (id: string) => (id === currentUserId ? "You" : names[id] ?? "Someone");

  const share = async () => {
    const withNames = debts.map((d) => ({
      ...d,
      fromUser: { id: d.fromUserId, name: names[d.fromUserId] ?? "Someone", avatarUrl: null },
      toUser: { id: d.toUserId, name: names[d.toUserId] ?? "Someone", avatarUrl: null },
    }));
    const text = formatSettlePlan(withNames, currentUserId, APP_NAME);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Settle plan copied");
      }
    } catch { /* share sheet dismissed */ }
  };

  return (
    <Card data-testid="group-debts">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Zap className="size-3.5 text-primary" /> Simplified debts
        </CardTitle>
        {debts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div role="group" aria-label="How to show the payments" className="flex rounded-lg border p-0.5 text-[11px] font-medium">
              {(["list", "graph"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-md px-2 py-0.5 capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={share}>
              <Share2 className="size-3.5" /> Share
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : debts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Everyone in this group is settled up.</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {debts.length} payment{debts.length === 1 ? "" : "s"} settle the whole group
            </p>
            {view === "graph" && (
              <DebtGraph
                people={Object.entries(names).map(([id, name]) => ({ id, name }))}
                debts={debts.map((d) => ({ fromUserId: d.fromUserId, toUserId: d.toUserId, amount: d.amount, currency: d.currency ?? "INR" }))}
                meId={currentUserId}
                format={formatCurrency}
                onPay={(g) => { const hit = debts.find((d) => d.fromUserId === g.fromUserId && d.toUserId === g.toUserId && (d.currency ?? "INR") === g.currency); if (hit) onPay(hit); }}
                personHref={(id) => `/friends/${id}`}
              />
            )}
            {view === "list" && debts.map((d) => (
              <div key={`${d.fromUserId}-${d.toUserId}-${d.currency}`} className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">{label(d.fromUserId)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate flex-1">{label(d.toUserId)}</span>
                <span className="font-semibold shrink-0">{formatCurrency(d.amount, d.currency ?? "INR")}</span>
                {d.fromUserId === currentUserId && (
                  <UpiPayLink vpa={upiIds[d.toUserId]} payeeName={names[d.toUserId]} amountCents={d.amount} currency={d.currency ?? "INR"} />
                )}
                {d.fromUserId === currentUserId && (
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onPay(d)}>Pay</Button>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
