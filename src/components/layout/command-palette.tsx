"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, Users, Receipt, UserPlus, BarChart3,
  Settings, Activity, Plus, Search, Moon, Sun,
  ArrowRight, Zap,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useTheme } from "next-themes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const commands = [
  {
    group: "Navigate",
    items: [
      { label: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
      { label: "Groups",     icon: Users,           href: "/groups" },
      { label: "Expenses",   icon: Receipt,         href: "/expenses" },
      { label: "Friends",    icon: UserPlus,        href: "/friends" },
      { label: "Activity",   icon: Activity,        href: "/activity" },
      { label: "Analytics",  icon: BarChart3,       href: "/analytics" },
      { label: "Settings",   icon: Settings,        href: "/settings" },
    ],
  },
  {
    group: "Create",
    items: [
      { label: "New expense",  icon: Plus, href: "/expenses/new" },
      { label: "New group",    icon: Plus, href: "/groups/new" },
      { label: "Add friend",   icon: Plus, href: "/friends?add=1" },
    ],
  },
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  // ⌘K / Ctrl+K shortcut — stable listener via ref to avoid re-binding on every state change
  const openRef = useRef(commandPaletteOpen);
  openRef.current = commandPaletteOpen;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!openRef.current);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setCommandPaletteOpen]);

  const navigate = useCallback(
    (href: string) => {
      setCommandPaletteOpen(false);
      router.push(href);
    },
    [router, setCommandPaletteOpen]
  );

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setCommandPaletteOpen(false);
  };

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-lg overflow-hidden"
        showClose={false}
      >
        <Command className="rounded-2xl" shouldFilter>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Search or jump to..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {commands.map(({ group, items }) => (
              <Command.Group key={group} heading={group} className="px-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {group}
                </div>
                {items.map(({ label, icon: Icon, href }) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => navigate(href)}
                    className={cn(
                      "flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer",
                      "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      "transition-colors"
                    )}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{label}</span>
                    <ArrowRight className="size-3 ml-auto text-muted-foreground opacity-0 aria-selected:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {/* Theme toggle */}
            <Command.Group className="px-2">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Appearance
              </div>
              <Command.Item
                value="toggle theme"
                onSelect={toggleTheme}
                className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-accent transition-colors"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-4 text-muted-foreground" />
                ) : (
                  <Moon className="size-4 text-muted-foreground" />
                )}
                <span>
                  Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer */}
          <div className="border-t px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="size-3" /> SplitFree
            </span>
            <span className="ml-auto flex items-center gap-2">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↑↓</kbd>
              navigate
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↵</kbd>
              select
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
