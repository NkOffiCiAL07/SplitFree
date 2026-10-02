"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Expense } from "@/types";
import { expenseToCreatePayload } from "@/lib/expense-payload";
import type { Changes } from "@/lib/revisions";

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
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
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
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      if (expense.groupId) qc.invalidateQueries({ queryKey: ["groups", expense.groupId] });
      toast.success("Expense updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function invalidateExpenseData(qc: ReturnType<typeof useQueryClient>, groupId?: string | null) {
  qc.invalidateQueries({ queryKey: ["expenses"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["analytics"] });
  qc.invalidateQueries({ queryKey: ["balance"] });
  qc.invalidateQueries({ queryKey: ["balances"] });
  qc.invalidateQueries({ queryKey: ["groups"] });
  if (groupId) qc.invalidateQueries({ queryKey: ["budget", groupId] });
}

/**
 * Pass the whole expense to get an "Undo" action on the toast (the expense is re-created from
 * its stored data); passing just an id still deletes, without undo.
 */
export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: string | Expense) => {
      const id = typeof target === "string" ? target : target.id;
      await fetchJSON(`/api/expenses/${id}`, { method: "DELETE" });
      return typeof target === "string" ? null : target;
    },
    onSuccess: (deleted) => {
      invalidateExpenseData(qc, deleted?.groupId);
      if (!deleted) {
        toast.success("Expense deleted");
        return;
      }
      toast.success("Expense deleted", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await fetchJSON("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(expenseToCreatePayload(deleted)),
              });
              invalidateExpenseData(qc, deleted.groupId);
              toast.success("Expense restored");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't restore the expense");
            }
          },
        },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expense: Expense) =>
      fetchJSON("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          expenseToCreatePayload(expense, { description: `${expense.description} (copy)`, date: new Date(), isRecurring: false })
        ),
      }),
    onSuccess: (dup: Expense) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      if (dup.groupId) qc.invalidateQueries({ queryKey: ["groups", dup.groupId] });
      toast.success("Expense duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ExpenseHistoryData {
  currency: string;
  /** userId → name for everyone mentioned in the revisions */
  people: Record<string, string>;
  revisions: { id: string; editorId: string; changes: Changes; createdAt: string }[];
}

/** Edit history of one expense; pass `enabled: false` to defer loading until it's shown. */
export function useExpenseHistory(id: string, enabled = true) {
  return useQuery<ExpenseHistoryData>({
    queryKey: ["expenses", id, "history"],
    queryFn: () => fetchJSON(`/api/expenses/${id}/history`),
    enabled: !!id && enabled,
  });
}

export interface ExpenseQuery {
  groupId?: string;
  q?: string;
  category?: string;
  from?: string;
  to?: string;
  recurring?: boolean;
  limit?: number;
}

/** Query string for the paged expenses API; empty/"ALL" filters are left out. */
export function expenseQueryString(query: ExpenseQuery, cursor?: string | null): string {
  const p = new URLSearchParams({ paged: "true" });
  if (query.groupId) p.set("groupId", query.groupId);
  if (query.q?.trim()) p.set("q", query.q.trim());
  if (query.category && query.category !== "ALL") p.set("category", query.category);
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  if (query.recurring) p.set("recurring", "true");
  if (query.limit) p.set("limit", String(query.limit));
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

/**
 * Every expense (not just the latest 50), newest first, filtered on the server so search and
 * filters cover the whole history. Call `fetchNextPage` for more.
 */
export function infiniteExpensesOptions(query: ExpenseQuery = {}) {
  return {
    queryKey: ["expenses", "infinite", query] as const,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }): Promise<ExpensePage> =>
      fetchJSON(`/api/expenses?${expenseQueryString(query, pageParam)}`),
    getNextPageParam: (last: ExpensePage) => last.nextCursor ?? undefined,
  };
}

export interface ExpensePage { items: Expense[]; nextCursor: string | null }

export function useInfiniteExpenses(query: ExpenseQuery = {}) {
  const result = useInfiniteQuery(infiniteExpensesOptions(query));
  return { ...result, expenses: result.data?.pages.flatMap((pg) => pg.items) ?? [] };
}
