"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Receipt, Users, ArrowRightLeft, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime, formatCurrency, getInitials } from "@/lib/utils";

async function fetchActivity() {
  const res = await fetch("/api/notifications");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  EXPENSE_ADDED: Receipt, EXPENSE_UPDATED: Receipt, EXPENSE_DELETED: Receipt,
  SETTLEMENT_ADDED: ArrowRightLeft, GROUP_JOINED: Users, GROUP_LEFT: Users,
  FRIEND_ADDED: UserPlus, PAYMENT_REMINDER: ArrowRightLeft,
};
const TYPE_COLOR: Record<string, string> = {
  EXPENSE_ADDED: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  EXPENSE_UPDATED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXPENSE_DELETED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  SETTLEMENT_ADDED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  GROUP_JOINED: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  GROUP_LEFT: "bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400",
  FRIEND_ADDED: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  PAYMENT_REMINDER: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function ActivityPage() {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchActivity,
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Activity</h2>
        <p className="text-sm text-muted-foreground">Your recent notifications and events</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !notifications?.length ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="When you add expenses, join groups, or settle up, it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any, i: number) => {
            const Icon = TYPE_ICON[n.type] ?? Receipt;
            const color = TYPE_COLOR[n.type] ?? "bg-gray-100 text-gray-600";
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-3 p-4 rounded-xl border bg-card transition-all ${!n.isRead ? "border-primary/20 bg-primary/5" : ""}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
