"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SimplifiedDebt } from "@/types";

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

export function useBalance() {
  return useQuery({
    queryKey: ["balance"],
    queryFn: () => fetchJSON("/api/balance"),
  });
}

export function useSettleUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { toUserId: string; amount: number; currency?: string; groupId?: string | null; note?: string }) =>
      fetchJSON("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["balances"] }); // friend/group balance chips
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Payment recorded!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Nudge someone who owes you (amount in cents). The server allows one reminder per person per day. */
export function useSendReminder() {
  return useMutation({
    mutationFn: (data: { debtorId: string; amount: number; currency: string }) =>
      fetchJSON("/api/settlements/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => toast.success("Reminder sent"),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Minimum payments that settle a whole group (every member, each currency netted separately). */
export function useGroupDebts(groupId: string) {
  return useQuery<{ simplified: SimplifiedDebt[] }>({
    queryKey: ["settlements", groupId, "simplified"],
    queryFn: () => fetchJSON(`/api/settlements?groupId=${groupId}&simplified=true`),
    enabled: !!groupId,
  });
}
