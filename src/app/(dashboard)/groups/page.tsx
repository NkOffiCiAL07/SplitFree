"use client";

import { useState, useMemo } from "react";
import { Users, Search, X } from "lucide-react";
import { useGroups } from "@/hooks/use-groups";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const CATEGORY_OPTIONS = ["ALL", "HOME", "TRIP", "FRIENDS", "COUPLE", "WORK", "OTHER"] as const;

export default function GroupsPage() {
  const { data: groups, isLoading } = useGroups();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const filtered = useMemo(() => {
    if (!groups) return [];
    return groups.filter((g) => {
      const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "ALL" || g.category === category;
      return matchSearch && matchCat;
    });
  }, [groups, search, category]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Groups</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{groups && filtered.length !== groups.length ? ` of ${groups.length}` : ""} groups
          </p>
        </div>
        <CreateGroupDialog />
      </div>

      {/* Search + filter */}
      {(groups?.length ?? 0) > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search groups…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground shrink-0"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c === "ALL" ? "All types" : c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : groups?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group to split expenses with your roommates, travel buddies, or anyone else."
          action={{ label: "Create your first group", onClick: () => {} }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No groups match"
          description="Try a different name or clear the filter."
          action={{ label: "Clear search", onClick: () => { setSearch(""); setCategory("ALL"); } }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((group, i) => (
            <GroupCard key={group.id} group={group} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
