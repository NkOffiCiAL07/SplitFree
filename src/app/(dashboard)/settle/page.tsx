"use client";

import { CURRENCY_CODES as CURRENCIES } from "@/lib/currencies";
import { useState } from "react";
import { m } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, CreditCard, Clock, Bell, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useSettlements, useSettleUp, useBalance, useSendReminder } from "@/hooks/use-settlements";
import { useFriendContacts } from "@/hooks/use-friends";
import { useAuth } from "@/hooks/use-auth";
import { useUserCurrency } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { SimplifiedDebt, Settlement } from "@/types";
import { buildUpiLink, formatSettlePlan } from "@/lib/settle-tools";
import { APP_NAME } from "@/lib/app-config";

import { formatCurrency, getInitials, formatDate, cn } from "@/lib/utils";

/** Sum debts per currency and join them ("$10.00 + ₹500.00") — never add across currencies. */
function totalsLabel(debts: { amount: number; currency?: string }[], fallback: string) {
  const byCurrency = new Map<string, number>();
  for (const d of debts) {
    const cur = d.currency ?? fallback;
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + d.amount);
  }
  if (byCurrency.size === 0) return formatCurrency(0, fallback);
  return [...byCurrency.entries()].map(([cur, amt]) => formatCurrency(amt, cur)).join(" + ");
}

export default function SettlePage() {
  const { data, isLoading } = useSettlements();
  const { data: balanceData, isLoading: balanceLoading } = useBalance();
  const { data: friends } = useFriendContacts();
  const { user } = useAuth();
  const settleUp = useSettleUp();
  const sendReminder = useSendReminder();
  const [upiId, setUpiId] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Currency of the debt being settled — payments must be recorded in the debt's own currency
  const [settleCurrency, setSettleCurrency] = useState<string | null>(null);
  const [debtLocked, setDebtLocked] = useState(false); // true when opened from a specific debt

  const userCurrency = useUserCurrency();
  const settlements = Array.isArray(data) ? data : [];
  const simplified: SimplifiedDebt[] = (balanceData as { simplified?: SimplifiedDebt[] } | undefined)?.simplified ?? [];

  const myDebts = simplified.filter((d) => d.fromUserId === user?.id);
  const othersDebts = simplified.filter((d) => d.toUserId === user?.id);

  const effectiveCurrency = settleCurrency ?? userCurrency;
  const selectedFriendName = friends?.find((f) => f.friendId === selectedFriend)?.friend?.name;
  const upiLink = buildUpiLink({
    vpa: upiId,
    name: selectedFriendName,
    amountCents: Math.round(parseFloat(amount || "0") * 100),
    note: note || `${APP_NAME} settle up`,
  });

  const sharePlan = async () => {
    const text = formatSettlePlan(simplified, user?.id, APP_NAME);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Settle plan copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !amount) return;
    await settleUp.mutateAsync({ toUserId: selectedFriend, amount: parseFloat(amount), currency: effectiveCurrency, note });
    setDialogOpen(false);
    setAmount("");
    setNote("");
    setSelectedFriend("");
    setSettleCurrency(null);
    setDebtLocked(false);
    setUpiId("");
  };

  const openSettleFor = (toUserId: string, amt: number, currency: string) => {
    setSelectedFriend(toUserId);
    setSettleCurrency(currency);
    setDebtLocked(true);
    setAmount((amt / 100).toFixed(2));
    setDialogOpen(true);
  };


  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Settle Up</h2>
          <p className="text-sm text-muted-foreground">Record payments and clear balances</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedFriend(""); setAmount(""); setNote(""); setSettleCurrency(null); setDebtLocked(false); setUpiId(""); } }}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm" className="gap-1.5">
              <CreditCard className="size-4" /> Record payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
            <form onSubmit={handleSettle} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Paid to</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                  {friends?.map((f) => (
                    <button
                      key={f.friendId}
                      type="button"
                      onClick={() => setSelectedFriend(f.friendId)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                        selectedFriend === f.friendId
                          ? "border-primary bg-primary/8 dark:bg-primary/10"
                          : "hover:bg-accent"
                      )}
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-xs">{getInitials(f.friend?.name ?? "?")}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium flex-1">{f.friend?.name}</span>
                      {selectedFriend === f.friendId && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </button>
                  ))}
                  {(!friends || friends.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-3">No friends yet — add friends first.</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <div className="flex gap-2">
                  <select
                    aria-label="Currency"
                    value={effectiveCurrency}
                    disabled={debtLocked}
                    onChange={(e) => setSettleCurrency(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-70"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              {effectiveCurrency === "INR" && (
                <div className="space-y-1.5">
                  <Label>Their UPI ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="flex gap-2">
                    <Input placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                    {upiLink && (
                      <Button asChild type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <a href={upiLink}><Smartphone className="size-3.5" /> Pay in UPI app</a>
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Opens GPay / PhonePe / Paytm on your phone. After paying, tap “Record payment” here.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="UPI, cash, bank transfer…" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" variant="brand" loading={settleUp.isPending} disabled={!selectedFriend || !amount}>
                <CheckCircle2 className="size-4 mr-1.5" /> Record payment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary pills */}
      {!balanceLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 p-4">
            <p className="text-xs text-muted-foreground mb-1">You owe</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {totalsLabel(myDebts, userCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{myDebts.length} payment{myDebts.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 p-4">
            <p className="text-xs text-muted-foreground mb-1">Owed to you</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {totalsLabel(othersDebts, userCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{othersDebts.length} payment{othersDebts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Simplified debts */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Simplified debts</h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">— minimum transactions to settle everything</span>
          {simplified.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1.5 text-xs" onClick={sharePlan}>
              <Share2 className="size-3.5" /> Share plan
            </Button>
          )}
        </div>

        {balanceLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : simplified.length === 0 ? (
          <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 p-5 text-center">
            <CheckCircle2 className="size-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">All settled up!</p>
            <p className="text-xs text-muted-foreground mt-0.5">No outstanding balances.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {simplified.map((debt, i: number) => {
              const isMyDebt = debt.fromUserId === user?.id;
              return (
                <m.div
                  key={`${debt.fromUserId}-${debt.toUserId}-${debt.currency}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border",
                    isMyDebt
                      ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                      : "bg-card"
                  )}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(isMyDebt ? (debt.toUser?.name ?? "?") : (debt.fromUser?.name ?? "?"))}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className={cn("text-sm font-medium truncate", isMyDebt ? "text-red-700 dark:text-red-400" : "")}>
                      {isMyDebt ? "You" : (debt.fromUser?.name ?? "Someone")}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {isMyDebt ? (debt.toUser?.name ?? "someone") : "You"}
                    </span>
                  </div>
                  <span className={cn("text-sm font-bold shrink-0", isMyDebt ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                    {formatCurrency(debt.amount, debt.currency ?? userCurrency)}
                  </span>
                  {isMyDebt && (
                    <Button
                      variant="brand"
                      size="sm"
                      className="text-xs h-7 px-3 shrink-0"
                      onClick={() => openSettleFor(debt.toUserId, debt.amount, debt.currency ?? userCurrency)}
                    >
                      Pay
                    </Button>
                  )}
                  {!isMyDebt && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-3 gap-1 shrink-0"
                      disabled={sendReminder.isPending}
                      onClick={() => sendReminder.mutate({ debtorId: debt.fromUserId, amount: debt.amount, currency: debt.currency ?? userCurrency })}
                    >
                      <Bell className="size-3" /> Remind
                    </Button>
                  )}
                </m.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settlement history */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Payment history</h3>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {settlements.map((s: Settlement, i: number) => {
              const isOutgoing = s.fromUserId === user?.id;
              return (
                <m.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card text-sm"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs",
                    isOutgoing ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  )}>
                    {isOutgoing ? "↑" : "↓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {isOutgoing
                        ? `You → ${s.toUser?.name}`
                        : `${s.fromUser?.name} → You`}
                    </p>
                    {s.note && <p className="text-[10px] text-muted-foreground truncate">{s.note}</p>}
                  </div>
                  <span className={cn("font-semibold shrink-0 text-sm", isOutgoing ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                    {isOutgoing ? "−" : "+"}{formatCurrency(s.amount, userCurrency)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(s.createdAt)}</span>
                </m.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
