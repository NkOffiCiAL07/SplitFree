"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, Receipt } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriendDetail } from "@/hooks/use-friends";
import { useSettleUp, useSendReminder } from "@/hooks/use-settlements";
import { UpiPayLink } from "@/components/shared/upi-pay-link";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";

export default function FriendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useFriendDetail(id);
  const settleUp = useSettleUp();
  const remind = useSendReminder();
  const [confirming, setConfirming] = useState<string | null>(null); // currency awaiting confirmation

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Couldn't load this person."}</p>
        <Button asChild variant="outline" size="sm"><Link href="/friends">Back to friends</Link></Button>
      </div>
    );
  }

  const { friend, balances, expenses, settlements } = data;
  const firstName = friend.name.split(" ")[0];

  const settle = async (currency: string, net: number) => {
    await settleUp.mutateAsync({ toUserId: friend.id, amount: Math.abs(net) / 100, currency, note: "Settled from friend page" });
    setConfirming(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <Link href="/friends" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Friends
      </Link>

      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          <AvatarImage src={friend.avatarUrl ?? undefined} />
          <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{friend.name}</h2>
          <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
        </div>
      </div>

      {/* Balance, one row per currency */}
      <Card data-testid="friend-balances">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Balance</CardTitle></CardHeader>
        <CardContent className="space-y-2 pt-0">
          {balances.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" /> You&apos;re all settled up with {firstName}.
            </p>
          ) : balances.map(({ currency, net }) => (
            <div key={currency} className="flex items-center gap-2">
              <p className={cn("flex-1 text-sm font-semibold", net > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {net > 0
                  ? `${firstName} owes you ${formatCurrency(net, currency)}`
                  : `You owe ${firstName} ${formatCurrency(-net, currency)}`}
              </p>
              {net > 0 ? (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={remind.isPending}
                  onClick={() => remind.mutate({ debtorId: friend.id, amount: net, currency })}>
                  <Bell className="size-3" /> Remind
                </Button>
              ) : confirming === currency ? (
                <>
                  <Button size="sm" variant="brand" className="h-7 text-xs" loading={settleUp.isPending} onClick={() => settle(currency, net)}>
                    Confirm {formatCurrency(-net, currency)}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirming(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <UpiPayLink vpa={friend.upiId} payeeName={friend.name} amountCents={-net} currency={currency} />
                  <Button size="sm" variant="brand" className="h-7 text-xs" onClick={() => setConfirming(currency)}>Settle up</Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Shared expenses */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><Receipt className="size-4" /> Shared expenses</h3>
        {expenses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shared expenses yet.</p>
        ) : expenses.map((e) => {
          const iPaid = e.paidById !== friend.id;
          const delta = e.delta; // + they owe me, − I owe them
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.description}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatDate(e.date)} · {e.multiplePayers ? "Paid by several" : iPaid ? "You paid" : `${firstName} paid`} {formatCurrency(e.amount, e.currency)}
                  {e.group ? ` · ${e.group.name}` : ""}
                </p>
              </div>
              <span className={cn("text-xs font-semibold shrink-0", delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {delta > 0 ? "you lent " : "you owe "}{formatCurrency(Math.abs(delta), e.currency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Payments between you */}
      {settlements.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Payments</h3>
          {settlements.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="flex-1 min-w-0 truncate">
                {s.fromUserId === friend.id ? `${firstName} paid you` : `You paid ${firstName}`}
                {s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(s.createdAt)}</span>
              <span className="font-semibold shrink-0">{formatCurrency(s.amount, s.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
