"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Receipt, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, formatRelativeTime, cn } from "@/lib/utils";
import type { Group } from "@/types";

const CATEGORY_CONFIG: Record<string, { emoji: string; gradient: string }> = {
  HOME:    { emoji: "🏠", gradient: "from-emerald-400 to-teal-500" },
  TRIP:    { emoji: "✈️", gradient: "from-sky-400 to-blue-500" },
  COUPLE:  { emoji: "💑", gradient: "from-pink-400 to-rose-500" },
  FRIENDS: { emoji: "👫", gradient: "from-violet-400 to-purple-500" },
  WORK:    { emoji: "💼", gradient: "from-amber-400 to-orange-500" },
  OTHER:   { emoji: "📦", gradient: "from-gray-400 to-slate-500" },
};

interface GroupCardProps { group: Group; index?: number; }

export function GroupCard({ group, index = 0 }: GroupCardProps) {
  const config = CATEGORY_CONFIG[group.category] ?? CATEGORY_CONFIG.OTHER;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Link href={`/groups/${group.id}`}>
        <div className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
          {/* Category icon */}
          <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl shrink-0 shadow-sm", config.gradient)}>
            {config.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{group.name}</h3>
              <Badge variant="outline" className="text-[10px] shrink-0 h-4 px-1.5">
                {group.currency}
              </Badge>
            </div>
            {group.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
            )}

            <div className="flex items-center gap-3 mt-2.5">
              {/* Member avatars */}
              <div className="flex -space-x-1.5">
                {group.members?.slice(0, 5).map((m) => (
                  <Avatar key={m.id} className="size-5 border-2 border-background">
                    <AvatarImage src={m.user?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[8px]">{getInitials(m.user?.name ?? "?")}</AvatarFallback>
                  </Avatar>
                ))}
                {(group.members?.length ?? 0) > 5 && (
                  <div className="size-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-medium">
                    +{(group.members?.length ?? 0) - 5}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="size-3" />{group._count?.members ?? group.members?.length}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Receipt className="size-3" />{group._count?.expenses ?? 0}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">{formatRelativeTime(group.updatedAt)}</span>
            </div>
          </div>

          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
