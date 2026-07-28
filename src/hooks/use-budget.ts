"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useGroupBudget(groupId: string) {
  return useQuery({
    queryKey: ["budget", groupId],
    queryFn: () => fetchJSON(`/api/groups/${groupId}/budget`),
    enabled: !!groupId,
  });
}

export function useSetBudget(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; category?: string | null; period?: string }) =>
      fetchJSON(`/api/groups/${groupId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget", groupId] });
      toast.success("Budget saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBudget(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: string) =>
      fetchJSON(`/api/groups/${groupId}/budget`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget", groupId] });
      toast.success("Budget removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
