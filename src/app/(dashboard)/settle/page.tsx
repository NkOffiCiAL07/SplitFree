"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, CreditCard, Clock } from "lucide-react";
import { useSettlements, useSettleUp, useBalance } from "@/hooks/use-settlements";
import { useFriends } from "@/hooks/use-friends";
import { useAuth } from "@/hooks/use-auth";
import { useUserCurrency } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getInitials, formatDate, cn } from "@/lib/utils";

export default function SettlePage() {
  const { data, isLoading } = useSettlements();
  const { data: balanceData, isLoading: balanceLoading } = useBalance();
  const { data: friends } = useFriends();
  const { user } = useAuth();
  const settleUp = useSettleUp();
  const [selectedFriend, setSelectedFriend] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const userCurrency = useUserCurrency();
  const settlements = Array.isArray(data) ? data : [];
  const simplified: any[] = (balanceData as any)?.simplified ?? [];

  const myDebts = simplified.filter((d: any) => d.fromUserId === user?.id);
  const othersDebts = simplified.filter((d: any) => d.toUserId === user?.id);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !amount) return;
    await settleUp.mutateAsync({ toUserId: selectedFriend, amount: parseFloat(amount), currency: userCurrency, note });
    setDialogOpen(false);
    setAmount("");
    setNote("");
    setSelectedFriend("");
  };

  const openSettleFor = (toUserId: string, amt: number) => {
    setSelectedFriend(toUserId);
    setAmount((amt / 100).toFixed(2));
    setDialogOpen(true);
  };

  const selectedFriendData = friends?.find((f) => f.friendId === selectedFriend);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Settle Up</h2>
          <p className="text-sm text-muted-foreground">Record payments and clear balances</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedFriend(""); setAmount(""); setNote(""); } }}>
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
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{userCurrency}</span>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="pl-12"
                  />
                </div>
              </div>
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
              {formatCurrency(myDebts.reduce((s: number, d: any) => s + d.amount, 0), userCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{myDebts.length} payment{myDebts.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 p-4">
            <p className="text-xs text-muted-foreground mb-1">Owed to you</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(othersDebts.reduce((s: number, d: any) => s + d.amount, 0), userCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{othersDebts.length} payment{othersDebts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Simplified debts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Simplified debts</h3>
          <span className="text-xs text-muted-foreground">— minimum transactions to settle everything</span>
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
            {simplified.map((debt: any, i: number) => {
              const isMyDebt = debt.fromUserId === user?.id;
              return (
                <motion.div
                  key={i}
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
                    {formatCurrency(debt.amount, userCurrency)}
                  </span>
                  {isMyDebt && (
                    <Button
                      variant="brand"
                      size="sm"
                      className="text-xs h-7 px-3 shrink-0"
                      onClick={() => openSettleFor(debt.toUserId, debt.amount)}
                    >
                      Pay
                    </Button>
                  )}
                </motion.div>
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
            {settlements.map((s: any, i: number) => {
              const isOutgoing = s.fromUserId === user?.id;
              return (
                <motion.div
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
