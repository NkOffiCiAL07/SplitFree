"use client";

import { motion } from "framer-motion";
import { Receipt, Users, ArrowRightLeft, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, formatCurrency, getInitials } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ActivityType } from "@/types";

const ICONS: Record<string, React.ElementType> = {
  EXPENSE_CREATED: Receipt, EXPENSE_UPDATED: Receipt, EXPENSE_DELETED: Receipt,
  SETTLEMENT_CREATED: ArrowRightLeft, GROUP_CREATED: Users,
  MEMBER_ADDED: UserPlus, MEMBER_REMOVED: UserPlus,
};
const COLORS: Record<string, string> = {
  EXPENSE_CREATED: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  EXPENSE_UPDATED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXPENSE_DELETED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  SETTLEMENT_CREATED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  GROUP_CREATED: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  MEMBER_ADDED: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  MEMBER_REMOVED: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

interface ActivityItem {
  id: string;
  type: ActivityType;
  metadata: any;
  user: { name: string; avatarUrl: string | null };
  createdAt: string | Date;
}

interface Props { activities?: ActivityItem[]; currency?: string; isLoading?: boolean }

function activityLabel(a: ActivityItem): { text: string; amount?: number } {
  const m = a.metadata as any ?? {};
  switch (a.type) {
    case "EXPENSE_CREATED": return { text: `${a.user.name} added ${m.description ?? "an expense"}`, amount: m.amount };
    case "EXPENSE_UPDATED": return { text: `${a.user.name} updated ${m.description ?? "an expense"}` };
    case "EXPENSE_DELETED": return { text: `${a.user.name} deleted ${m.description ?? "an expense"}` };
    case "SETTLEMENT_CREATED": return { text: `${a.user.name} recorded a payment`, amount: m.amount };
    case "GROUP_CREATED": return { text: `${a.user.name} created group ${m.groupName ?? ""}` };
    case "MEMBER_ADDED": return { text: `${a.user.name} joined ${m.groupName ?? "a group"}` };
    case "MEMBER_REMOVED": return { text: `${a.user.name} left ${m.groupName ?? "a group"}` };
    default: return { text: "Activity recorded" };
  }
}

export function RecentActivity({ activities = [], currency = "USD", isLoading }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity" className="text-xs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-0">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg mb-2" />)
          ) : activities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No activity yet. Add an expense to get started!</p>
          ) : (
            activities.map((activity, i) => {
              const Icon = ICONS[activity.type] ?? Receipt;
              const color = COLORS[activity.type] ?? "bg-gray-100 text-gray-600";
              const { text, amount } = activityLabel(activity);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  className="flex items-start gap-3 py-3 border-b last:border-0"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-5 shrink-0">
                          <AvatarImage src={activity.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[8px]">{getInitials(activity.user.name)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs truncate">{text}</p>
                      </div>
                      {amount != null && (
                        <span className="text-xs font-semibold shrink-0 text-green-600 dark:text-green-400">
                          {formatCurrency(amount, currency)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-7">
                      {formatRelativeTime(new Date(activity.createdAt))}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
