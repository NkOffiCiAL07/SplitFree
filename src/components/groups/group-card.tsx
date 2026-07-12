"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { Group } from "@/types";

const CATEGORY_EMOJI: Record<string, string> = {
  HOME:"🏠", TRIP:"✈️", COUPLE:"💑", FRIENDS:"👫", WORK:"💼", OTHER:"📦",
};

interface GroupCardProps { group: Group; index?: number; }

export function GroupCard({ group, index = 0 }: GroupCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Link href={`/groups/${group.id}`}>
        <Card className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center text-xl shrink-0">
                {CATEGORY_EMOJI[group.category] ?? "📦"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm truncate">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {group.currency}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  {/* Members avatars */}
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {group.members?.slice(0, 4).map((m) => (
                        <Avatar key={m.id} className="size-6 border-2 border-background">
                          <AvatarImage src={m.user?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(m.user?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-1 flex items-center gap-1">
                      <Users className="size-3" />
                      {group._count?.members ?? group.members?.length}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Receipt className="size-3" />
                    {group._count?.expenses ?? 0} expenses
                  </span>

                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatRelativeTime(group.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
