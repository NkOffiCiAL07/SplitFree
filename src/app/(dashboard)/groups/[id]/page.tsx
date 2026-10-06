"use client";

import { useAccent } from "@/components/shared/accent-provider";
import { buildGroupInviteMessage, whatsappShareUrl } from "@/lib/invite";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { MessageCircle, ArrowLeft, UserPlus, Trash2, CheckCircle2, LogOut, Archive, ArchiveRestore, Crown, Link2, Pencil, QrCode, Plus, MoreVertical, Search, Mail, Download, Share2, X } from "lucide-react";
import { useGroup, useDeleteGroup, useAddMember, useRemoveMember, useLeaveGroup, useTransferOwnership, useArchiveGroup } from "@/hooks/use-groups";
import { useFriendContacts } from "@/hooks/use-friends";
import { useDeleteExpense, useInfiniteExpenses } from "@/hooks/use-expenses";
import { useDebounceValue } from "usehooks-ts";
import { useSettleUp } from "@/hooks/use-settlements";
import { useAuth } from "@/hooks/use-auth";
import { ExpenseComments } from "@/components/expenses/expense-comments";
import { ReactionBar, ReactionChips } from "@/components/expenses/reaction-bar";
import { BudgetCard } from "@/components/groups/budget-card";
import { netForUser, payersLabel } from "@/lib/expense-display";
import { ExpenseHistory } from "@/components/expenses/expense-history";
import type { Expense } from "@/types";
import { GroupDebtsCard } from "@/components/groups/group-debts-card";
import { GroupStatsCard } from "@/components/groups/group-stats-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { LazyAddExpenseDialog as AddExpenseDialog } from "@/components/expenses/lazy-add-expense-dialog";
import { LazyEditGroupDialog as EditGroupDialog } from "@/components/groups/lazy-group-dialogs";
import { toast } from "sonner";
import { saveBlob } from "@/lib/save-file";
// The QR code library is only needed when the invite dialog opens
const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });
import { APP_NAME } from "@/lib/app-config";

// Only fetched when the user actually edits an expense
const EditExpenseDialog = dynamic(
  () => import("@/components/expenses/edit-expense-dialog").then((m) => m.EditExpenseDialog),
  { ssr: false }
);

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const accent = useAccent(); // the invite QR takes the chosen colour theme
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(id);
  const deleteMutation = useDeleteGroup();
  const addMemberMutation = useAddMember();
  const removeMemberMutation = useRemoveMember();
  const leaveGroup = useLeaveGroup();
  const transferOwnership = useTransferOwnership();
  const archiveGroup = useArchiveGroup();
  const settleUp = useSettleUp();
  const [addEmail, setAddEmail] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const { data: friends } = useFriendContacts();
  const [settleTarget, setSettleTarget] = useState<{ userId: string; name: string; balance: number; currency?: string } | null>(null);
  const [settleNote, setSettleNote] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const deleteExpense = useDeleteExpense();
  // The group's FULL expense history (not just the latest few), searchable on the server
  const [expenseSearch, setExpenseSearch] = useState("");
  const [debouncedExpenseSearch] = useDebounceValue(expenseSearch, 300);
  const { expenses, isLoading: expensesLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteExpenses({ groupId: id, q: debouncedExpenseSearch });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);

  const myMember = group?.members?.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === "ADMIN";
  const isCreator = group?.createdById === user?.id;

  const handleDelete = async () => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    await deleteMutation.mutateAsync(id);
    router.push("/groups");
  };

  const handleLeave = async () => {
    if (!confirm("Leave this group? You can only leave if all balances are settled.")) return;
    try {
      await leaveGroup.mutateAsync({ groupId: id, userId: user!.id });
      router.push("/groups");
    } catch {
      // error already shown via toast in the hook
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail) return;
    await addMemberMutation.mutateAsync({ groupId: id, email: addEmail });
    setAddEmail("");
    setAddDialogOpen(false);
  };

  const downloadQRCode = () => {
    const svgEl = document.getElementById("qr-invite-svg") as SVGElement | null;
    if (!svgEl) return;
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    const size = 320;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        saveBlob(blob, `${group?.name ?? "group"}-invite-qr.png`).catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't save the QR code"));
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
  };

  const shareOnWhatsApp = async () => {
    const res = await fetch(`/api/groups/${id}/invite-link`);
    const json = await res.json();
    if (!json.data?.token) { toast.error("Failed to generate invite link"); return; }
    const text = buildGroupInviteMessage(group?.name ?? "our group", `${window.location.origin}/join/${json.data.token}`, user?.user_metadata?.name);
    window.open(whatsappShareUrl(text), "_blank", "noopener,noreferrer");
  };

  const shareQRCode = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${group?.name} on ${APP_NAME}`, url: qrUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(qrUrl);
      toast.success("Link copied!");
    }
  };

  const handleQuickSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const amountDollars = Math.abs(settleTarget.balance) / 100;
    await settleUp.mutateAsync({
      toUserId: settleTarget.userId,
      amount: amountDollars,
      currency: settleTarget.currency ?? group?.currency,
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

  const memberNames: Record<string, string> = Object.fromEntries(
    (group.members ?? []).map((mm) => [mm.userId, mm.user?.name ?? "Member"])
  );
  const isArchived = !!group.archivedAt;
  // memberBalances lists everyone ELSE (balance > 0 = they owe me), so my net is simply their sum.
  // (It used to look for my own entry, which never exists, so the banner always said "All settled up!")
  const myBalance = (group.memberBalances ?? []).reduce((sum, mb) => sum + mb.balance, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{group.name}</h2>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Add expense — icon-only on mobile, text on desktop (archived groups are read-only) */}
          {!isArchived && (
            <AddExpenseDialog groupId={id} groupCurrency={group.currency} members={group.members ?? []}>
              <Button variant="brand" size="sm" className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add expense</span>
              </Button>
            </AddExpenseDialog>
          )}

          {/* Secondary actions — inline on desktop, dropdown on mobile */}
          <div className="hidden sm:flex items-center gap-1">
            {isAdmin && <EditGroupDialog group={group} open={editGroupOpen} onOpenChange={setEditGroupOpen} />}
            <Button
              variant="ghost" size="icon-sm" title="Copy invite link"
              className="text-muted-foreground hover:text-foreground"
              onClick={async () => {
                const res = await fetch(`/api/groups/${id}/invite-link`);
                const json = await res.json();
                if (json.data?.token) {
                  await navigator.clipboard.writeText(`${window.location.origin}/join/${json.data.token}`);
                  toast.success("Invite link copied!");
                } else toast.error("Failed to generate invite link");
              }}
            >
              <Link2 className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon-sm" title="Invite on WhatsApp" aria-label="Invite on WhatsApp"
              className="text-muted-foreground hover:text-green-600"
              onClick={shareOnWhatsApp}
            >
              <MessageCircle className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon-sm" title="QR code invite"
              className="text-muted-foreground hover:text-foreground"
              onClick={async () => {
                const res = await fetch(`/api/groups/${id}/invite-link`);
                const json = await res.json();
                if (json.data?.token) {
                  setQrUrl(`${window.location.origin}/join/${json.data.token}`);
                  setQrOpen(true);
              } else {
                toast.error("Failed to generate QR code");
              }
            }}
          >
                  <QrCode className="size-4" />
                </Button>
                {!isCreator && (
                  <Button
                    variant="ghost" size="icon-sm" title="Leave group"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={handleLeave}
                  >
                    <LogOut className="size-4" />
                  </Button>
                )}
                {isCreator && (
                  <Button
                    variant="ghost" size="icon-sm" title="Delete group"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              {/* Mobile: ⋮ dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="sm:hidden text-muted-foreground">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isAdmin && (
                    <DropdownMenuItem onSelect={() => setEditGroupOpen(true)}>
                      <Pencil className="size-4 mr-2" /> Edit group
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={async () => {
                    const res = await fetch(`/api/groups/${id}/invite-link`);
                    const json = await res.json();
                    if (json.data?.token) {
                      await navigator.clipboard.writeText(`${window.location.origin}/join/${json.data.token}`);
                      toast.success("Invite link copied!");
                    } else toast.error("Failed to generate invite link");
                  }}>
                    <Link2 className="size-4 mr-2" /> Copy invite link
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={shareOnWhatsApp}>
                    <MessageCircle className="size-4 mr-2" /> Invite on WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={async () => {
                    const res = await fetch(`/api/groups/${id}/invite-link`);
                    const json = await res.json();
                    if (json.data?.token) {
                      setQrUrl(`${window.location.origin}/join/${json.data.token}`);
                      setQrOpen(true);
                    } else toast.error("Failed to generate QR code");
                  }}>
                    <QrCode className="size-4 mr-2" /> QR code invite
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      onSelect={async () => {
                        if (!isArchived && !confirm("Archive this group? It becomes read-only history; you can restore it any time.")) return;
                        await archiveGroup.mutateAsync({ id, archived: !isArchived });
                      }}
                    >
                      {isArchived ? <ArchiveRestore className="size-4 mr-2" /> : <Archive className="size-4 mr-2" />}
                      {isArchived ? "Restore group" : "Archive group"}
                    </DropdownMenuItem>
                  )}
                  {!isCreator && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleLeave} className="text-destructive focus:text-destructive">
                        <LogOut className="size-4 mr-2" /> Leave group
                      </DropdownMenuItem>
                    </>
                  )}
                  {isCreator && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
                        <Trash2 className="size-4 mr-2" /> Delete group
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

        </div>
      </div>

      {isArchived && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
          <Archive className="size-4 shrink-0" />
          <span className="flex-1">This group is archived — it&apos;s read-only history. You can still settle up.</span>
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs" loading={archiveGroup.isPending}
              onClick={() => archiveGroup.mutate({ id, archived: false })}>
              Restore
            </Button>
          )}
        </div>
      )}

      {/* Balance banner */}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-5 text-white",
          myBalance >= 0 ? "bg-green-600 dark:border dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-600 dark:border dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-300"
        )}
      >
        <p className="text-sm text-white/80 dark:text-current dark:opacity-80">Your balance in this group</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(Math.abs(myBalance), group.currency)}</p>
        <p className="text-sm mt-1 text-white/80 dark:text-current dark:opacity-80">
          {myBalance > 0 ? "You are owed" : myBalance < 0 ? "You owe" : "All settled up!"}
        </p>
      </m.div>

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
            {!isArchived && (
            <Dialog open={addDialogOpen} onOpenChange={(o) => { setAddDialogOpen(o); if (!o) { setAddEmail(""); setFriendSearch(""); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <UserPlus className="size-3.5" /> Add member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  {/* Friends picker */}
                  {(() => {
                    const memberIds = new Set((group.members ?? []).map((m) => m.userId));
                    const eligible = (friends ?? []).filter((f) => !memberIds.has(f.friendId));
                    const filtered = eligible.filter((f) => {
                      const q = friendSearch.toLowerCase();
                      return !q || (f.friend?.name ?? "").toLowerCase().includes(q) || (f.friend?.email ?? "").toLowerCase().includes(q);
                    });
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">From your friends</p>
                        {eligible.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">All your friends are already in this group.</p>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search friends…"
                                value={friendSearch}
                                onChange={(e) => setFriendSearch(e.target.value)}
                                className="pl-8 h-8 text-xs"
                              />
                            </div>
                            <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-input p-1">
                              {filtered.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">No matches</p>
                              ) : filtered.map((f) => (
                                <button
                                  key={f.friendId}
                                  type="button"
                                  disabled={addMemberMutation.isPending}
                                  onClick={async () => {
                                    await addMemberMutation.mutateAsync({ groupId: id, email: f.friend?.email ?? "" });
                                    setAddDialogOpen(false);
                                    setFriendSearch("");
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-primary/8 transition-colors text-left disabled:opacity-50"
                                >
                                  <Avatar className="size-7 shrink-0">
                                    <AvatarImage src={f.friend?.avatarUrl ?? undefined} />
                                    <AvatarFallback className="text-[10px]">{getInitials(f.friend?.name ?? f.friend?.email ?? "?")}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{f.friend?.name ?? f.friend?.email}</p>
                                    {f.friend?.name && <p className="text-[10px] text-muted-foreground truncate">{f.friend.email}</p>}
                                  </div>
                                  <UserPlus className="size-3.5 text-muted-foreground shrink-0" />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {/* Email fallback */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Or add by email</p>
                    <form onSubmit={handleAddMember} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="friend@example.com"
                          value={addEmail}
                          onChange={(e) => setAddEmail(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <Button type="submit" variant="brand" size="sm" loading={addMemberMutation.isPending} disabled={!addEmail}>
                        Add
                      </Button>
                    </form>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {group.members?.map((member) => (
            <m.div
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
            </m.div>
          ))}
        </div>
      </div>

      {/* Per-member balances */}
      {(() => {
        const memberBalances = group.memberBalances ?? [];
        if (memberBalances.length === 0) return null;
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Who owes who</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memberBalances.map((mb) => (
                <m.div
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
                </m.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Group-wide summary: fewest payments to settle everyone + spending totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GroupDebtsCard
          groupId={id}
          names={memberNames}
          currentUserId={user?.id}
          upiIds={Object.fromEntries((group.members ?? []).map((mm) => [mm.userId, mm.user?.upiId]))}
          onPay={(d) => setSettleTarget({ userId: d.toUserId, name: memberNames[d.toUserId] ?? "member", balance: -d.amount, currency: d.currency })}
        />
        <GroupStatsCard stats={group.stats} names={memberNames} currentUserId={user?.id} />
      </div>

      {/* Quick settle dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(open) => { if (!open) { setSettleTarget(null); setSettleNote(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle with {settleTarget?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickSettle} className="space-y-4 mt-2">
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-center">
              You owe <span className="font-bold">{settleTarget && formatCurrency(Math.abs(settleTarget.balance), settleTarget.currency ?? group.currency)}</span> to {settleTarget?.name}
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

      {/* QR Code invite dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden" showClose={false}>
          {/* Gradient hero */}
          <div className="gradient-brand px-6 pt-6 pb-8 flex flex-col items-center gap-5">
            {/* Top bar */}
            <div className="w-full flex items-start justify-between">
              <div>
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">{APP_NAME}</p>
                <p className="text-white font-bold text-xl leading-tight mt-0.5">{group.name}</p>
                <p className="text-white/70 text-xs mt-0.5">Scan the code to join</p>
              </div>
              <button
                onClick={() => setQrOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center text-white shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* QR white card */}
            {qrUrl && (
              <div className="bg-white rounded-3xl p-5 shadow-2xl shadow-black/30">
                <QRCodeSVG
                  id="qr-invite-svg"
                  value={qrUrl}
                  size={210}
                  level="H"
                  fgColor={accent.scale[700]}
                  bgColor="#ffffff"
                  imageSettings={{
                    src: "/icons/icon-192x192.png",
                    height: 50,
                    width: 50,
                    excavate: true,
                  }}
                />
              </div>
            )}
          </div>
          {/* Action row */}
          <div className="grid grid-cols-3 gap-2 p-4">
            <button
              onClick={downloadQRCode}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-input hover:bg-muted transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Download className="size-4" />
              Save
            </button>
            <button
              onClick={shareQRCode}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-input hover:bg-muted transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Share2 className="size-4" />
              Share
            </button>
            <button
              onClick={async () => { await navigator.clipboard.writeText(qrUrl); toast.success("Link copied!"); }}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-input hover:bg-muted transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Link2 className="size-4" />
              Copy link
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget */}
      <BudgetCard groupId={id} currency={group.currency} />

      <Separator />

      {/* Expenses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-sm">Expenses ({group._count?.expenses ?? expenses.length})</h3>
          {(group._count?.expenses ?? 0) > 5 && (
            <div className="relative w-44 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                aria-label="Search this group's expenses"
                placeholder="Search expenses…"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}
        </div>
        {expensesLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {debouncedExpenseSearch.trim() ? "No expenses match your search." : "No expenses yet. Add the first one!"}
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp, i: number) => (
              <ExpenseRow
                key={exp.id}
                expense={exp}
                userId={user?.id ?? ""}
                index={i}
                groupCurrency={group.currency}
                onEdit={() => setEditingExpense(exp as Expense)}
                onDelete={() => deleteExpense.mutate(exp)}
                onClick={() => setViewingExpense(exp as Expense)}
              />
            ))}
            {hasNextPage && (
              <Button variant="outline" className="w-full" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            )}
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

      {/* Expense detail + comments dialog */}
      <Dialog open={!!viewingExpense} onOpenChange={(o) => { if (!o) setViewingExpense(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90svh] overflow-y-auto">
          {viewingExpense && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{EXPENSE_EMOJI[viewingExpense.category] ?? "📦"}</span>
                  <span className="truncate">{viewingExpense.description}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(viewingExpense.amount, viewingExpense.currency ?? group.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid by</span>
                  <span className="font-medium">{payersLabel(viewingExpense)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDate(viewingExpense.date)}</span>
                </div>
                {viewingExpense.notes && (
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{viewingExpense.notes}</p>
                )}
                {viewingExpense.splits && viewingExpense.splits.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Split</p>
                    {(viewingExpense.splits ?? []).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                        <Avatar className="size-6 shrink-0">
                          <AvatarFallback className="text-[9px]">{getInitials(s.user?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">{s.user?.name ?? s.userId}</span>
                        <span className="text-sm font-semibold">{formatCurrency(s.amount, viewingExpense.currency ?? group.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <ReactionBar key={viewingExpense.id} expenseId={viewingExpense.id} reactions={viewingExpense.reactions} />
                <ExpenseHistory expenseId={viewingExpense.id} />
                <ExpenseComments expenseId={viewingExpense.id} />
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="flex-1 gap-1.5"
                    onClick={() => { setEditingExpense(viewingExpense); setViewingExpense(null); }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="destructive" size="sm" className="gap-1.5"
                    onClick={() => { deleteExpense.mutate(viewingExpense); setViewingExpense(null); }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EXPENSE_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

function ExpenseRow({ expense, userId, index, groupCurrency, onEdit, onDelete, onClick }: {
  expense: Expense; userId: string; index: number; groupCurrency?: string;
  onEdit: () => void; onDelete: () => void; onClick?: () => void;
}) {
  const net = netForUser(expense, userId);
  const currency = expense.currency ?? groupCurrency; // the expense's own currency, not the group's

  return (
    <m.div
      initial={index < 12 ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index < 12 ? index * 0.04 : 0, duration: 0.25 }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
        {EXPENSE_EMOJI[expense.category] ?? "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          {payersLabel(expense)} · {formatDate(expense.date)}
        </p>
        <ReactionChips reactions={expense.reactions} />
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatCurrency(expense.amount, currency)}</p>
        {net !== null && net !== 0 && (
          <p className={cn("text-xs", net > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {net > 0 ? `you lent ${formatCurrency(net, currency)}` : `you owe ${formatCurrency(-net, currency)}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </m.div>
  );
}

