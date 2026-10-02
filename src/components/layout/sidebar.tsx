"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { m } from "framer-motion";
import {
  LayoutDashboard, Users, Receipt, UserPlus, BarChart3,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen,
  Zap, Activity, RefreshCw,
} from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/hooks/use-auth";
import { usePrefetchOnIntent } from "@/hooks/use-prefetch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups",    label: "Groups",    icon: Users },
  { href: "/expenses",  label: "Expenses",  icon: Receipt },
  { href: "/friends",   label: "Friends",   icon: UserPlus },
  { href: "/activity",   label: "Activity",   icon: Activity },
  { href: "/analytics",  label: "Analytics",  icon: BarChart3 },
  { href: "/recurring",  label: "Recurring",  icon: RefreshCw },
];

const bottomItems = [
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  // ⌘B / Ctrl+B toggles the sidebar (as in ChatGPT, Claude, Linear…), except while typing in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      toggleSidebar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <m.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex flex-col h-full border-r bg-card shrink-0 overflow-hidden"
      >
        {/* Header: logo + collapse control (the toggle lives here, like ChatGPT/Claude — not floating on the edge) */}
        <div className={cn("flex items-center h-14 border-b shrink-0", sidebarOpen ? "justify-between px-3" : "justify-center px-2")}>
          {sidebarOpen ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shrink-0">
                  <Zap className="size-4 text-white" />
                </div>
                <span className="font-bold text-base truncate">{APP_NAME}</span>
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <PanelLeftClose className="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse sidebar <kbd className="ml-1.5 rounded border px-1 text-[10px] opacity-70">⌘B</kbd></TooltipContent>
              </Tooltip>
            </>
          ) : (
            // Collapsed: the logo IS the expand button — it swaps to the panel icon on hover/focus
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="group relative flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:bg-accent"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg gradient-brand transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                    <Zap className="size-4 text-white" />
                  </span>
                  <PanelLeftOpen className="absolute size-[18px] text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar <kbd className="ml-1.5 rounded border px-1 text-[10px] opacity-70">⌘B</kbd></TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={Icon}
                active={active}
                collapsed={!sidebarOpen}
              />
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="py-3 px-2 border-t space-y-0.5">
          {bottomItems.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={pathname === href}
              collapsed={!sidebarOpen}
            />
          ))}

          {/* Sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                  !sidebarOpen && "justify-center"
                )}
              >
                <LogOut className="size-4 shrink-0" />
                {sidebarOpen && <span>Sign out</span>}
              </button>
            </TooltipTrigger>
            {!sidebarOpen && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>

          {/* User */}
          {user && (
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors mt-2",
                !sidebarOpen && "justify-center"
              )}
            >
              <Avatar className="size-7 shrink-0">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {getInitials(user.user_metadata?.name ?? user.email ?? "U")}
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {user.user_metadata?.name ?? "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              )}
            </Link>
          )}
        </div>

      </m.aside>
    </TooltipProvider>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) {
  const intent = usePrefetchOnIntent();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          {...intent(href)}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            collapsed && "justify-center",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Icon className="size-4 shrink-0" />
          {!collapsed && <span>{label}</span>}
          {active && !collapsed && (
            <m.div
              layoutId="sidebar-active"
              className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
            />
          )}
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}
