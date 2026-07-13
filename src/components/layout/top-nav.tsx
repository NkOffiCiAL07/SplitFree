"use client";

import { useCallback } from "react";
import { Menu, Search, Plus } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/groups":    "Groups",
  "/expenses":  "Expenses",
  "/friends":   "Friends",
  "/activity":  "Activity",
  "/analytics": "Analytics",
  "/settings":  "Settings",
  "/profile":   "Profile",
  "/settle":    "Settle Up",
};

export function TopNav() {
  const { toggleSidebar, toggleMobileMenu, setCommandPaletteOpen } = useUIStore();
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(path + "/")
  )?.[1] ?? "SplitFree";

  const openCommand = useCallback(() => {
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4">
      {/* Mobile menu */}
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="size-4" />
      </button>

      {/* Page title */}
      <motion.h1
        key={title}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-sm font-semibold flex-1"
      >
        {title}
      </motion.h1>

      {/* Search */}
      <button
        onClick={openCommand}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 text-muted-foreground text-xs hover:bg-accent hover:text-foreground transition-colors min-w-[180px]"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px]">
          <span>⌘</span>K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={openCommand}
          aria-label="Search"
        >
          <Search className="size-4" />
        </Button>
        <NotificationBell />
        <ThemeToggle />
        <AddExpenseButton />
      </div>
    </header>
  );
}

function AddExpenseButton() {
  const { setCommandPaletteOpen } = useUIStore();
  return (
    <Button
      size="sm"
      variant="brand"
      className="gap-1.5 hidden sm:flex"
      onClick={() => setCommandPaletteOpen(true)}
    >
      <Plus className="size-3.5" />
      Add expense
    </Button>
  );
}
