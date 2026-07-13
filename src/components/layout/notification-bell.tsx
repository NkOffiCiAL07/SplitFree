"use client";

import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchNotifications() {
  const res = await fetch("/api/notifications");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data ?? [];
}

async function markAllReadAPI() {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markAll: true }),
  });
}

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: markAllReadAPI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const friendAction = useMutation({
    mutationFn: async ({ requesterId, action, notifId }: { requesterId: string; action: "accept" | "decline"; notifId: string }) => {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requesterId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      // Mark the notification as read
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notifId] }),
      });
      return { action };
    },
    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast.success(action === "accept" ? "Friend request accepted!" : "Friend request declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full gradient-brand text-[9px] font-bold text-white"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n: any) => {
                const isPendingFriendRequest = n.type === "FRIEND_ADDED" && n.data?.pending === true;
                const requesterId = n.data?.userId as string | undefined;

                return (
                  <div
                    key={n.id}
                    className={`w-full text-left px-4 py-3 border-b last:border-0 ${!n.isRead ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                      {n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(new Date(n.createdAt))}
                        </p>
                        {isPendingFriendRequest && requesterId && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="brand"
                              className="h-7 text-xs px-3 gap-1"
                              loading={friendAction.isPending}
                              onClick={(e) => { e.stopPropagation(); friendAction.mutate({ requesterId, action: "accept", notifId: n.id }); }}
                            >
                              <Check className="size-3" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-3 gap-1"
                              loading={friendAction.isPending}
                              onClick={(e) => { e.stopPropagation(); friendAction.mutate({ requesterId, action: "decline", notifId: n.id }); }}
                            >
                              <X className="size-3" /> Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs h-8" asChild>
            <a href="/activity">View all activity</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
