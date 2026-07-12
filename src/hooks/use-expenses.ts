"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Expense } from "@/types";

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useExpenses(groupId?: string) {
  const params = groupId ? `?groupId=${groupId}` : "";
  return useQuery<Expense[]>({
    queryKey: ["expenses", groupId ?? "all"],
    queryFn: () => fetchJSON(`/api/expenses${params}`),
  });
}

export function useExpense(id: string) {
  return useQuery<Expense>({
    queryKey: ["expenses", id],
    queryFn: () => fetchJSON(`/api/expenses/${id}`),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetchJSON("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onMutate: async () => {
      // optimistic: could add placeholder, kept simple
    },
    onSuccess: (expense: Expense) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      if (expense.groupId) qc.invalidateQueries({ queryKey: ["groups", expense.groupId] });
      toast.success("Expense added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchJSON(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (expense: Expense) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses", expense.id] });
      toast.success("Expense updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
