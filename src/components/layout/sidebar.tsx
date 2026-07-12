"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Receipt, UserPlus, BarChart3,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  Zap, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups",    label: "Groups",    icon: Users },
  { href: "/expenses",  label: "Expenses",  icon: Receipt },
  { href: "/friends",   label: "Friends",   icon: UserPlus },
  { href: "/activity",  label: "Activity",  icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const bottomItems = [
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex flex-col h-full border-r bg-card shrink-0 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shrink-0">
              <Zap className="size-4 text-white" />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="font-bold text-base truncate"
                >
                  SplitFree
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
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

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-[72px] z-20 flex size-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <ChevronLeft className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>
      </motion.aside>
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
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
            <motion.div
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
