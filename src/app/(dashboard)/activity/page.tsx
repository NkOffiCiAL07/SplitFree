"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Receipt, Users, ArrowRightLeft, UserPlus, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

async function fetchActivity() {
  const res = await fetch("/api/activity");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  EXPENSE_ADDED: Receipt,    EXPENSE_CREATED: Receipt,
  EXPENSE_UPDATED: Pencil,
  EXPENSE_DELETED: Trash2,
  SETTLEMENT_ADDED: ArrowRightLeft, SETTLEMENT_CREATED: ArrowRightLeft,
  GROUP_JOINED: Users,       GROUP_CREATED: Users,
  GROUP_LEFT: Users,
  FRIEND_ADDED: UserPlus,
  PAYMENT_REMINDER: ArrowRightLeft,
  MEMBER_ADDED: UserPlus,    MEMBER_REMOVED: UserPlus,
};

const TYPE_COLOR: Record<string, string> = {
  EXPENSE_ADDED: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  EXPENSE_CREATED: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  EXPENSE_UPDATED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXPENSE_DELETED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  SETTLEMENT_ADDED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  SETTLEMENT_CREATED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  GROUP_JOINED: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  GROUP_CREATED: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  GROUP_LEFT: "bg-gray-100 text-gray-600",
  FRIEND_ADDED: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  PAYMENT_REMINDER: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  MEMBER_ADDED: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  MEMBER_REMOVED: "bg-gray-100 text-gray-600",
};

export default function ActivityPage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: fetchActivity,
  });

  const unread = items?.filter((n: any) => !n.isRead) ?? [];

  const friendAction = useMutation({
    mutationFn: async ({ requesterId, action, notifId }: { requesterId: string; action: "accept" | "decline"; notifId: string }) => {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requesterId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notifId] }),
      });
      return { action };
    },
    onSuccess: ({ action }: { action: string }) => {
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      import("sonner").then(({ toast }) => toast.success(action === "accept" ? "Friend request accepted!" : "Friend request declined"));
    },
  });

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Activity</h2>
          <p className="text-sm text-muted-foreground">Your actions and notifications</p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !items?.length ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="When you add expenses, join groups, or settle up, it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item: any, i: number) => {
            const Icon = TYPE_ICON[item.type] ?? Receipt;
            const color = TYPE_COLOR[item.type] ?? "bg-gray-100 text-gray-600";
            const isOwn = item.source === "activity";
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border bg-card transition-all",
                  !item.isRead && "border-primary/20 bg-primary/5"
                )}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {isOwn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  {item.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(item.createdAt)}</p>
                  {item.type === "FRIEND_ADDED" && item.data?.pending && item.data?.userId && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="brand" className="h-7 text-xs px-3 gap-1" loading={friendAction.isPending}
                        onClick={() => friendAction.mutate({ requesterId: item.data.userId, action: "accept", notifId: item.id.replace("notif_", "") })}>
                        <Check className="size-3" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1" loading={friendAction.isPending}
                        onClick={() => friendAction.mutate({ requesterId: item.data.userId, action: "decline", notifId: item.id.replace("notif_", "") })}>
                        <X className="size-3" /> Decline
                      </Button>
                    </div>
                  )}
                </div>
                {!item.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
