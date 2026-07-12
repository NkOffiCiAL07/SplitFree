"use client";

import { Users } from "lucide-react";
import { useGroups } from "@/hooks/use-groups";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function GroupsPage() {
  const { data: groups, isLoading } = useGroups();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Groups</h2>
          <p className="text-sm text-muted-foreground">{groups?.length ?? 0} groups</p>
        </div>
        <CreateGroupDialog />
      </div>

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
      ) : (
        <div className="space-y-3">
          {groups?.map((group, i) => (
            <GroupCard key={group.id} group={group} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
