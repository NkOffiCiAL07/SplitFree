"use client";

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

interface Props {
  groupId: string;
  /** userId → display name */
  names: Record<string, string>;
  currentUserId?: string;
  /** Called when the user taps Pay on a debt they owe */
  onPay: (debt: SimplifiedDebt) => void;
}

/** "Simplify group debts": the fewest payments that settle everyone in the group. */
export function GroupDebtsCard({ groupId, names, currentUserId, onPay }: Props) {
  const { data, isLoading } = useGroupDebts(groupId);
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
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={share}>
            <Share2 className="size-3.5" /> Share
          </Button>
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
            {debts.map((d) => (
              <div key={`${d.fromUserId}-${d.toUserId}-${d.currency}`} className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">{label(d.fromUserId)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate flex-1">{label(d.toUserId)}</span>
                <span className="font-semibold shrink-0">{formatCurrency(d.amount, d.currency ?? "INR")}</span>
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
