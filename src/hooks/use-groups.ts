"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Group } from "@/types";

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useGroups() {
  return useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: () => fetchJSON("/api/groups"),
  });
}

export function useGroup(id: string) {
  return useQuery<Group>({
    queryKey: ["groups", id],
    queryFn: () => fetchJSON(`/api/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetchJSON("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (group: Group) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success(`Group "${group.name}" created`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchJSON(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (group: Group) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["groups", group.id] });
      toast.success("Group updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJSON(`/api/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, email }: { groupId: string; email: string }) =>
      fetchJSON(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    onSuccess: (data: any, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      if (data?.invited) {
        toast.success(`Invite sent to ${data.email}`);
      } else {
        toast.success("Member added");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      fetchJSON(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: (_data, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
