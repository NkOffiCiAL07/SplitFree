"use client";

import { apiFetch } from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const fetchJSON = apiFetch;

export function useComments(expenseId: string) {
  return useQuery({
    queryKey: ["comments", expenseId],
    queryFn: () => fetchJSON(`/api/expenses/${expenseId}/comments`),
    enabled: !!expenseId,
  });
}

export function useAddComment(expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      fetchJSON(`/api/expenses/${expenseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", expenseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteComment(expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      fetchJSON(`/api/expenses/${expenseId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", expenseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
