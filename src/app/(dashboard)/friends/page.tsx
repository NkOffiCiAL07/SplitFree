"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserMinus, Mail, Check, X, Clock } from "lucide-react";
import { useFriends, useAddFriend, useRemoveFriend, usePendingFriendRequests, useRespondToFriendRequest } from "@/hooks/use-friends";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getInitials, formatRelativeTime } from "@/lib/utils";

export default function FriendsPage() {
  const { data: friendships, isLoading } = useFriends();
  const { data: pending, isLoading: pendingLoading } = usePendingFriendRequests();
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const respond = useRespondToFriendRequest();
  const [email, setEmail] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await addFriend.mutateAsync(email);
    setEmail("");
    setDialogOpen(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Friends</h2>
          <p className="text-sm text-muted-foreground">
            {friendships?.length ?? 0} friends
            {(pending?.length ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                · {pending!.length} pending
              </span>
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
                Enter their email address. They must have a SplitFree account.
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

      {/* Pending requests section */}
      {!pendingLoading && (pending?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="size-3.5 text-amber-500" />
            Pending requests
            <Badge variant="secondary" className="text-[10px] px-1.5">{pending!.length}</Badge>
          </h3>
          {pending!.map((req: any, i: number) => (
            <motion.div
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
            </motion.div>
          ))}
        </div>
      )}

      {/* Friends list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : friendships?.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No friends yet"
          description="Add friends by email to track shared expenses with them outside of groups."
          action={{ label: "Add your first friend", onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {friendships?.map((friendship, i) => (
            <motion.div
              key={friendship.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
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
              </div>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(friendship.createdAt)}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                onClick={() => removeFriend.mutate(friendship.friendId)}
              >
                <UserMinus className="size-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
