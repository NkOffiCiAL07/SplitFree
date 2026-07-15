"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, BarChart3, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useUIStore } from "@/stores/ui-store";

const navItems = [
  { href: "/dashboard", label: "Home",    icon: LayoutDashboard },
  { href: "/groups",    label: "Groups",  icon: Users },
  { href: null,         label: "Add",     icon: Plus, isFab: true },
  { href: "/friends",   label: "Friends", icon: UserPlus },
  { href: "/analytics", label: "Stats",   icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();
  const { setCommandPaletteOpen } = useUIStore();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map(({ href, label, icon: Icon, isFab }) => {
          if (isFab) {
            return (
              <button
                key="fab"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex flex-col items-center gap-1 px-2 relative -mt-5"
                aria-label="Add expense"
              >
                <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Plus className="size-5 text-white" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{label}</span>
              </button>
            );
          }

          const active = pathname === href || (href && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href!}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors relative min-w-0",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="size-5 relative z-10" />
              <span className="text-[10px] font-medium relative z-10">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
