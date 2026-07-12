"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useSettlements(groupId?: string) {
  const params = new URLSearchParams();
  if (groupId) params.set("groupId", groupId);
  return useQuery({
    queryKey: ["settlements", groupId ?? "all"],
    queryFn: () => fetchJSON(`/api/settlements?${params}`),
  });
}

export function useSettleUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { toUserId: string; amount: number; groupId?: string; note?: string }) =>
      fetchJSON("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Payment recorded!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
