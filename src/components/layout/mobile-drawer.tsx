"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Receipt, UserPlus, BarChart3,
  Settings, LogOut, Zap, Activity, X,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups",    label: "Groups",    icon: Users },
  { href: "/expenses",  label: "Expenses",  icon: Receipt },
  { href: "/friends",   label: "Friends",   icon: UserPlus },
  { href: "/activity",  label: "Activity",  icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function MobileDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { user, signOut } = useAuth();

  const close = () => setMobileMenuOpen(false);

  const handleSignOut = async () => {
    close();
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={close}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-card border-r flex flex-col lg:hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
              <Link href="/dashboard" onClick={close} className="flex items-center gap-3">
                <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
                  <Zap className="size-4 text-white" />
                </div>
                <span className="font-bold text-base">SplitFree</span>
              </Link>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <X className="size-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom */}
            <div className="border-t px-3 py-3 space-y-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="size-4 shrink-0" />
                <span>Sign out</span>
              </button>

              {user && (
                <Link
                  href="/profile"
                  onClick={close}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors mt-1"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.user_metadata?.name ?? user.email ?? "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.user_metadata?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
