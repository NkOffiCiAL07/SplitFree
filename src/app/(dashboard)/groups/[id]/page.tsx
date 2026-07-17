"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Trash2, Receipt, CheckCircle2, LogOut, Crown, Link2, Pencil } from "lucide-react";
import { useGroup, useDeleteGroup, useAddMember, useRemoveMember, useLeaveGroup, useTransferOwnership } from "@/hooks/use-groups";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { useSettleUp } from "@/hooks/use-settlements";
import { useAuth } from "@/hooks/use-auth";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import type { Expense } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EditGroupDialog } from "@/components/groups/edit-group-dialog";
import { toast } from "sonner";

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(id);
  const deleteMutation = useDeleteGroup();
  const addMemberMutation = useAddMember();
  const removeMemberMutation = useRemoveMember();
  const leaveGroup = useLeaveGroup();
  const transferOwnership = useTransferOwnership();
  const settleUp = useSettleUp();
  const [addEmail, setAddEmail] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ userId: string; name: string; balance: number } | null>(null);
  const [settleNote, setSettleNote] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const deleteExpense = useDeleteExpense();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const myMember = group?.members?.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === "ADMIN";
  const isCreator = group?.createdById === user?.id;

  const handleDelete = async () => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    await deleteMutation.mutateAsync(id);
    router.push("/groups");
  };

  const handleLeave = async () => {
    if (!confirm("Leave this group?")) return;
    await leaveGroup.mutateAsync({ groupId: id, userId: user!.id });
    router.push("/groups");
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail) return;
    await addMemberMutation.mutateAsync({ groupId: id, email: addEmail });
    setAddEmail("");
    setAddDialogOpen(false);
  };

  const handleQuickSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const amountDollars = Math.abs(settleTarget.balance) / 100;
    await settleUp.mutateAsync({
      toUserId: settleTarget.userId,
      amount: amountDollars,
      currency: group?.currency,
      groupId: id,
      note: settleNote || undefined,
    });
    setSettleTarget(null);
    setSettleNote("");
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    const target = group?.members?.find((m) => m.userId === transferTarget);
    if (!confirm(`Transfer admin rights to ${target?.user?.name}?`)) return;
    await transferOwnership.mutateAsync({ groupId: id, userId: transferTarget });
    setTransferTarget(null);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!group) return null;

  const expenses = (group as any).expenses ?? [];
  const myBalance = ((group as any).memberBalances ?? []).reduce((sum: number, mb: any) => sum + mb.balance, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{group.name}</h2>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <AddExpenseDialog groupId={id} groupCurrency={group.currency} members={group.members ?? []} />
          {isAdmin && <EditGroupDialog group={group} />}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Copy invite link"
            className="text-muted-foreground hover:text-foreground"
            onClick={async () => {
              const res = await fetch(`/api/groups/${id}/invite-link`);
              const json = await res.json();
              if (json.data?.token) {
                const url = `${window.location.origin}/join/${json.data.token}`;
                await navigator.clipboard.writeText(url);
                toast.success("Invite link copied!");
              } else {
                toast.error("Failed to generate invite link");
              }
            }}
          >
            <Link2 className="size-4" />
          </Button>
          {!isCreator && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Leave group"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleLeave}
            >
              <LogOut className="size-4" />
            </Button>
          )}
          {isCreator && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              title="Delete group"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Balance banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-5 text-white",
          myBalance >= 0 ? "bg-green-600" : "bg-red-600"
        )}
      >
        <p className="text-sm text-white/80">Your balance in this group</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(Math.abs(myBalance), group.currency)}</p>
        <p className="text-sm mt-1 text-white/80">
          {myBalance > 0 ? "You are owed" : myBalance < 0 ? "You owe" : "All settled up!"}
        </p>
      </motion.div>

      {/* Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Members ({group.members?.length})</h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={!!transferTarget} onOpenChange={(o) => { if (!o) setTransferTarget(null); }}>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>Transfer ownership</DialogTitle></DialogHeader>
                  <div className="space-y-2 mt-2">
                    {group.members?.filter((m) => m.userId !== user?.id && m.role !== "ADMIN").map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => setTransferTarget(m.userId)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors",
                          transferTarget === m.userId ? "border-primary bg-primary/5" : "hover:bg-accent"
                        )}
                      >
                        <Avatar className="size-8">
                          <AvatarImage src={m.user?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">{getInitials(m.user?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{m.user?.name}</span>
                      </button>
                    ))}
                    <Button
                      className="w-full mt-2"
                      variant="brand"
                      disabled={!transferTarget}
                      loading={transferOwnership.isPending}
                      onClick={handleTransferOwnership}
                    >
                      <Crown className="size-4 mr-1.5" /> Transfer ownership
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <UserPlus className="size-3.5" /> Add member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
                <form onSubmit={handleAddMember} className="space-y-3 mt-2">
                  <Input
                    type="email"
                    placeholder="friend@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" className="w-full" variant="brand" loading={addMemberMutation.isPending}>
                    Add member
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {group.members?.map((member) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl border bg-card"
            >
              <Avatar className="size-8">
                <AvatarImage src={member.user?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">{getInitials(member.user?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.user?.email}</p>
              </div>
              {member.role === "ADMIN" && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
              {isAdmin && member.userId !== user?.id && (
                <div className="flex items-center gap-1">
                  {member.role !== "ADMIN" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Make admin"
                      className="text-muted-foreground hover:text-amber-500 size-7"
                      onClick={() => setTransferTarget(member.userId)}
                    >
                      <Crown className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive size-7"
                    onClick={() => removeMemberMutation.mutate({ groupId: id, userId: member.userId })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Per-member balances */}
      {(() => {
        const memberBalances = (group as any).memberBalances ?? [];
        if (memberBalances.length === 0) return null;
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Who owes who</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memberBalances.map((mb: any) => (
                <motion.div
                  key={mb.userId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    mb.balance > 0 ? "bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30" : "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
                  )}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={mb.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(mb.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mb.name}</p>
                    <p className={cn("text-xs", mb.balance > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                      {mb.balance > 0 ? "owes you" : "you owe"}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold shrink-0", mb.balance > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {formatCurrency(Math.abs(mb.balance), group.currency)}
                  </span>
                  {mb.balance < 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2 shrink-0"
                      onClick={() => setSettleTarget({ userId: mb.userId, name: mb.name, balance: mb.balance })}
                    >
                      Settle
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick settle dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(open) => { if (!open) { setSettleTarget(null); setSettleNote(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle with {settleTarget?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickSettle} className="space-y-4 mt-2">
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-center">
              You owe <span className="font-bold">{settleTarget && formatCurrency(Math.abs(settleTarget.balance), group.currency)}</span> to {settleTarget?.name}
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="Paid via UPI, cash…" value={settleNote} onChange={(e) => setSettleNote(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" variant="brand" loading={settleUp.isPending}>
              <CheckCircle2 className="size-4 mr-1.5" /> Record full payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Expenses */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Expenses ({expenses.length})</h3>
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No expenses yet. Add the first one!
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp: any, i: number) => (
              <ExpenseRow
                key={exp.id}
                expense={exp}
                userId={user?.id ?? ""}
                index={i}
                groupCurrency={group.currency}
                onEdit={() => setEditingExpense(exp as Expense)}
                onDelete={() => deleteExpense.mutate(exp.id)}
              />
            ))}
          </div>
        )}
        {editingExpense && (
          <EditExpenseDialog
            expense={editingExpense}
            open={!!editingExpense}
            onClose={() => setEditingExpense(null)}
          />
        )}
      </div>
    </div>
  );
}

const EXPENSE_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

function ExpenseRow({ expense, userId, index, groupCurrency, onEdit, onDelete }: {
  expense: any; userId: string; index: number; groupCurrency?: string;
  onEdit: () => void; onDelete: () => void;
}) {
  const myShare = expense.splits?.find((s: any) => s.userId === userId);
  const isPayer = expense.paidById === userId;
  const currency = groupCurrency ?? expense.currency;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
        {EXPENSE_EMOJI[expense.category] ?? "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          {expense.paidBy?.name} · {formatDate(expense.date)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatCurrency(expense.amount, currency)}</p>
        {myShare && (
          <p className={cn("text-xs", isPayer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {isPayer ? `+${formatCurrency(expense.amount - myShare.amount, currency)}` : `-${formatCurrency(myShare.amount, currency)}`}
          </p>
        )}
      </div>
      {isPayer && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

