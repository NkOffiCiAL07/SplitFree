"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Receipt, UserPlus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/groups",    label: "Groups",   icon: Users },
  { href: "/expenses",  label: "Expenses", icon: Receipt },
  { href: "/friends",   label: "Friends",  icon: UserPlus },
  { href: "/analytics", label: "Stats",    icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors relative",
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
