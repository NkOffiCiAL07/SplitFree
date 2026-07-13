"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import { useSettlements, useSettleUp, useBalance } from "@/hooks/use-settlements";
import { useFriends } from "@/hooks/use-friends";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getInitials, formatDate } from "@/lib/utils";

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

  const settlements = Array.isArray(data) ? data : [];
  const simplified: any[] = (balanceData as any)?.simplified ?? [];

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !amount) return;
    await settleUp.mutateAsync({ toUserId: selectedFriend, amount: parseFloat(amount), note });
    setDialogOpen(false);
    setAmount("");
    setNote("");
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Settle Up</h2>
          <p className="text-sm text-muted-foreground">Record payments and clear balances</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm" className="gap-1.5">
              <CheckCircle2 className="size-4" /> Record payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
            <form onSubmit={handleSettle} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Paid to</Label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
                  value={selectedFriend}
                  onChange={(e) => setSelectedFriend(e.target.value)}
                  required
                >
                  <option value="">Select friend…</option>
                  {friends?.map((f) => (
                    <option key={f.friendId} value={f.friendId}>{f.friend?.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input placeholder="Payment via Venmo…" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" variant="brand" loading={settleUp.isPending}>
                Record payment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Simplified debts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Simplified debts</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum transactions to settle all balances across all groups.
        </p>
        {balanceLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : simplified.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">All settled up!</p>
        ) : (
          <div className="space-y-2">
            {simplified.map((debt: any, i: number) => {
              const isMyDebt = debt.fromUserId === user?.id;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-card"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={debt.fromUser?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(debt.fromUser?.name ?? "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{isMyDebt ? "You" : debt.fromUser?.name}</span>
                    <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{isMyDebt ? debt.toUser?.name : "You"}</span>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">
                    {formatCurrency(debt.amount)}
                  </span>
                  {isMyDebt && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2 shrink-0"
                      onClick={() => {
                        setSelectedFriend(debt.toUserId);
                        setAmount((debt.amount / 100).toFixed(2));
                        setDialogOpen(true);
                      }}
                    >
                      Settle
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
        <h3 className="font-semibold text-sm">Payment history</h3>
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {settlements.map((s: any, i: number) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card text-sm"
              >
                <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                <span className="flex-1 truncate">
                  {s.fromUser?.name} → {s.toUser?.name}
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400 shrink-0">
                  {formatCurrency(s.amount)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(s.createdAt)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
