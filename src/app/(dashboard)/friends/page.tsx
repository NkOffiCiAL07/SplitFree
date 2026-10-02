"use client";

import { useState, useMemo } from "react";
import { m } from "framer-motion";
import { UserPlus, UserMinus, Mail, Check, X, Clock, SendHorizonal, Receipt, Users } from "lucide-react";
import {
  useFriends, useAddFriend, useRemoveFriend,
  usePendingFriendRequests, useRespondToFriendRequest,
  useSentFriendRequests, useCancelFriendRequest,
} from "@/hooks/use-friends";
import { useGroups } from "@/hooks/use-groups";
import { useBalances } from "@/hooks/use-balances";
import { useAuth } from "@/hooks/use-auth";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getInitials, formatRelativeTime, formatCompactCurrency, cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/app-config";
import type { Friendship, GroupMember } from "@/types";

export default function FriendsPage() {
  const { user } = useAuth();
  const { data: friendships, isLoading } = useFriends();
  const { data: groups } = useGroups();
  const { data: pending } = usePendingFriendRequests();
  const { data: sent } = useSentFriendRequests();
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const respond = useRespondToFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const { data: balances } = useBalances();
  const [email, setEmail] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseFriend, setExpenseFriend] = useState<{ id: string; name?: string; avatarUrl?: string | null } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await addFriend.mutateAsync(email);
    setEmail("");
    setDialogOpen(false);
  };

  // People from your groups who aren't already friends
  const friendIds = useMemo(() => new Set(friendships?.map((f) => f.friendId) ?? []), [friendships]);

  const groupContacts = useMemo(() => {
    if (!groups || !user) return [];
    const seen = new Set<string>();
    const contacts: { id: string; name?: string; avatarUrl?: string | null; groupName: string }[] = [];
    for (const group of groups) {
      for (const member of group.members ?? []) {
        if (member.userId === user.id) continue;
        if (friendIds.has(member.userId)) continue;
        if (seen.has(member.userId)) continue;
        seen.add(member.userId);
        contacts.push({
          id: member.userId,
          name: member.user?.name,
          avatarUrl: member.user?.avatarUrl,
          groupName: group.name,
        });
      }
    }
    return contacts;
  }, [groups, user, friendIds]);

  // Build members array for the expense dialog (current user + selected friend)
  const expenseMembers: GroupMember[] = useMemo(() => {
    if (!expenseFriend || !user) return [];
    const placeholder = { avatarUrl: null, currency: "USD" as const, timezone: "UTC", createdAt: new Date() };
    return [
      { id: "", groupId: "", userId: user.id, role: "MEMBER" as const, joinedAt: new Date(), user: { ...placeholder, id: user.id, name: user.user_metadata?.name ?? user.email ?? "You", email: user.email ?? "" } },
      { id: "", groupId: "", userId: expenseFriend.id, role: "MEMBER" as const, joinedAt: new Date(), user: { ...placeholder, id: expenseFriend.id, name: expenseFriend.name ?? "Friend", email: "" } },
    ];
  }, [expenseFriend, user]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Friends</h2>
          <p className="text-sm text-muted-foreground">
            {friendships?.length ?? 0} friends
            {(pending?.length ?? 0) > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">· {pending!.length} pending</span>
            )}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm" className="gap-1.5">
              <UserPlus className="size-4" /> Add friend
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Add a friend</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Enter their email address. They must have a {APP_NAME} account.
              </p>
              <Input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full" variant="brand" loading={addFriend.isPending}>
                Send friend request
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incoming pending requests */}
      {(pending?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="size-3.5 text-amber-500" />
            Received requests
            <Badge variant="secondary" className="text-[10px] px-1.5">{pending!.length}</Badge>
          </h3>
          {pending!.map((req: any, i: number) => (
            <m.div
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-4 rounded-xl border bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30"
            >
              <Avatar className="size-10">
                <AvatarImage src={req.user?.avatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(req.user?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{req.user?.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="size-3" /> {req.user?.email}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="brand"
                  className="h-7 px-2.5 text-xs gap-1"
                  loading={respond.isPending}
                  onClick={() => respond.mutate({ requesterId: req.userId, action: "accept" })}
                >
                  <Check className="size-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => respond.mutate({ requesterId: req.userId, action: "decline" })}
                >
                  <X className="size-3" /> Decline
                </Button>
              </div>
            </m.div>
          ))}
        </div>
      )}

      {/* Sent pending requests */}
      {(sent?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <SendHorizonal className="size-3.5 text-blue-500" />
            Sent requests
            <Badge variant="secondary" className="text-[10px] px-1.5">{sent!.length}</Badge>
          </h3>
          {sent!.map((req: any, i: number) => (
            <m.div
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-4 rounded-xl border bg-blue-50/60 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
            >
              <Avatar className="size-10">
                <AvatarImage src={req.friend?.avatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(req.friend?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{req.friend?.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="size-3" /> {req.friend?.email}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 shrink-0"
                loading={cancelRequest.isPending}
                onClick={() => cancelRequest.mutate(req.friendId)}
              >
                <X className="size-3" /> Cancel
              </Button>
            </m.div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-2">
        {(friendships?.length ?? 0) > 0 && (
          <h3 className="text-sm font-semibold">Friends ({friendships?.length ?? 0})</h3>
        )}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : friendships?.length === 0 && groupContacts.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No friends yet"
            description="Add friends by email to track shared expenses with them outside of groups."
            action={{ label: "Add your first friend", onClick: () => setDialogOpen(true) }}
          />
        ) : (
          friendships?.map((friendship, i) => (
            <m.div
              key={friendship.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i < 10 ? i * 0.05 : 0, duration: 0.25 }}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card group hover:shadow-sm transition-all"
            >
              <Avatar className="size-10">
                <AvatarImage src={friendship.friend?.avatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(friendship.friend?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{friendship.friend?.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="size-3" /> {friendship.friend?.email}
                </p>
                {(() => {
                  const b = balances?.byPerson[friendship.friendId];
                  if (!b || b.net === 0) return null;
                  return (
                    <p className={cn(
                      "text-xs font-semibold mt-0.5",
                      b.net > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {b.net > 0
                        ? `lent ${formatCompactCurrency(b.net, b.currency)}`
                        : `owes ${formatCompactCurrency(Math.abs(b.net), b.currency)}`}
                    </p>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block shrink-0">
                {formatRelativeTime(friendship.createdAt)}
              </p>
              <Button
                size="sm"
                variant="brand"
                className="gap-1.5 h-8 px-3 text-xs shrink-0"
                onClick={() => setExpenseFriend({ id: friendship.friendId, name: friendship.friend?.name, avatarUrl: friendship.friend?.avatarUrl })}
              >
                <Receipt className="size-3.5" /> Add expense
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                onClick={() => removeFriend.mutate(friendship.friendId)}
              >
                <UserMinus className="size-4" />
              </Button>
            </m.div>
          ))
        )}
      </div>

      {/* Group contacts — people in your groups who aren't friends yet */}
      {groupContacts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="size-3.5 text-violet-500" />
            From your groups
            <Badge variant="secondary" className="text-[10px] px-1.5">{groupContacts.length}</Badge>
          </h3>
          {groupContacts.map((contact, i) => (
            <m.div
              key={contact.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i < 10 ? i * 0.05 : 0, duration: 0.25 }}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card/60 group hover:shadow-sm transition-all"
            >
              <Avatar className="size-10">
                <AvatarImage src={contact.avatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(contact.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{contact.name ?? "Member"}</p>
                <p className="text-xs text-muted-foreground truncate">via {contact.groupName}</p>
                {(() => {
                  const b = balances?.byPerson[contact.id];
                  if (!b || b.net === 0) return null;
                  return (
                    <p className={cn(
                      "text-xs font-semibold mt-0.5",
                      b.net > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {b.net > 0
                        ? `lent ${formatCompactCurrency(b.net, b.currency)}`
                        : `owes ${formatCompactCurrency(Math.abs(b.net), b.currency)}`}
                    </p>
                  );
                })()}
              </div>
              <Button
                size="sm"
                variant="brand"
                className="gap-1.5 h-8 px-3 text-xs shrink-0"
                onClick={() => setExpenseFriend({ id: contact.id, name: contact.name, avatarUrl: contact.avatarUrl })}
              >
                <Receipt className="size-3.5" /> Add expense
              </Button>
            </m.div>
          ))}
        </div>
      )}

      {/* Add expense dialog for individual friend */}
      <AddExpenseDialog
        open={!!expenseFriend}
        onOpenChange={(open) => { if (!open) setExpenseFriend(null); }}
        members={expenseMembers}
      />
    </div>
  );
}
