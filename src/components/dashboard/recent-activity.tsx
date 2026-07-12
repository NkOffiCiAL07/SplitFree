"use client";

import { motion } from "framer-motion";
import { Receipt, Users, ArrowRightLeft, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatCurrency, getInitials } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ActivityType } from "@/types";

const DEMO_ACTIVITIES = [
  {
    id: "1",
    type: "EXPENSE_CREATED" as ActivityType,
    description: "Alex added Dinner at Nobu",
    amount: 12000,
    user: { name: "Alex Chen", avatarUrl: null },
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    type: "SETTLEMENT_CREATED" as ActivityType,
    description: "Sarah settled up with you",
    amount: 4500,
    user: { name: "Sarah Kim", avatarUrl: null },
    createdAt: new Date(Date.now() - 1000 * 60 * 62),
  },
  {
    id: "3",
    type: "GROUP_CREATED" as ActivityType,
    description: "Weekend Trip group created",
    amount: null,
    user: { name: "You", avatarUrl: null },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "4",
    type: "EXPENSE_CREATED" as ActivityType,
    description: "James added Uber ride",
    amount: 2400,
    user: { name: "James Park", avatarUrl: null },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
  },
  {
    id: "5",
    type: "MEMBER_ADDED" as ActivityType,
    description: "Maya joined Weekend Trip",
    amount: null,
    user: { name: "Maya Patel", avatarUrl: null },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

const activityIcons: Record<ActivityType, React.ElementType> = {
  EXPENSE_CREATED:    Receipt,
  EXPENSE_UPDATED:    Receipt,
  EXPENSE_DELETED:    Receipt,
  SETTLEMENT_CREATED: ArrowRightLeft,
  GROUP_CREATED:      Users,
  MEMBER_ADDED:       UserPlus,
  MEMBER_REMOVED:     UserPlus,
};

const activityColors: Record<ActivityType, string> = {
  EXPENSE_CREATED:    "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  EXPENSE_UPDATED:    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXPENSE_DELETED:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  SETTLEMENT_CREATED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  GROUP_CREATED:      "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  MEMBER_ADDED:       "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  MEMBER_REMOVED:     "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

export function RecentActivity() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
    >
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity" className="text-xs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-0">
          {DEMO_ACTIVITIES.map((activity, i) => {
            const Icon = activityIcons[activity.type];
            const color = activityColors[activity.type];
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                className="flex items-start gap-3 py-3 border-b last:border-0"
              >
                {/* Activity icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="size-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-5 shrink-0">
                        <AvatarImage src={activity.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(activity.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs truncate">{activity.description}</p>
                    </div>
                    {activity.amount !== null && (
                      <span className="text-xs font-semibold shrink-0 text-green-600 dark:text-green-400">
                        {formatCurrency(activity.amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-7">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
