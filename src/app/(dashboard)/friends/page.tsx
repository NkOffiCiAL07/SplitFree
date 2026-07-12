"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserMinus, Mail } from "lucide-react";
import { useFriends, useAddFriend, useRemoveFriend } from "@/hooks/use-friends";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getInitials, formatRelativeTime } from "@/lib/utils";

export default function FriendsPage() {
  const { data: friendships, isLoading } = useFriends();
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
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
          <p className="text-sm text-muted-foreground">{friendships?.length ?? 0} friends</p>
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
