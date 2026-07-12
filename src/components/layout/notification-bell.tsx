"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// placeholder until notification API is wired up
const DEMO_NOTIFICATIONS = [
  {
    id: "1",
    title: "Alex added an expense",
    body: "Dinner at Nobu — $120.00 split equally",
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    title: "Sarah settled up",
    body: "Sarah paid you $45.00",
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: "3",
    title: "New group member",
    body: "James joined Weekend Trip",
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export function NotificationBell() {
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

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
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-0 ${
                    !n.isRead ? "bg-primary/5" : ""
                  }`}
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
                    )
                  }
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    {n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
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
