"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Friendship, FriendRequest, Expense, Settlement } from "@/types";
import type { CurrencyNet } from "@/lib/pair-balance";

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useFriends() {
  return useQuery<Friendship[]>({
    queryKey: ["friends"],
    queryFn: () => fetchJSON("/api/friends"),
  });
}

/** Friends plus people from your groups — use for pickers; Friends page uses useFriends. */
export function useFriendContacts() {
  return useQuery<Friendship[]>({
    queryKey: ["friends", "contacts"],
    queryFn: () => fetchJSON("/api/friends?contacts=true"),
  });
}

export function usePendingFriendRequests() {
  return useQuery<FriendRequest[]>({
    queryKey: ["friends", "pending"],
    queryFn: () => fetchJSON("/api/friends?pending=true"),
  });
}

export function useSentFriendRequests() {
  return useQuery<FriendRequest[]>({
    queryKey: ["friends", "sent"],
    queryFn: () => fetchJSON("/api/friends?sent=true"),
  });
}

export function useCancelFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) =>
      fetchJSON("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", "sent"] });
      toast.success("Request cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRespondToFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requesterId, action }: { requesterId: string; action: "accept" | "decline" }) =>
      fetchJSON("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requesterId }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      toast.success(vars.action === "accept" ? "Friend request accepted!" : "Request declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      fetchJSON("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Friend added!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) =>
      fetchJSON("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Friend removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface FriendDetail {
  friend: { id: string; name: string; email: string; avatarUrl: string | null };
  /** Net per currency: positive = they owe you, negative = you owe them */
  balances: CurrencyNet[];
  expenses: (Pick<Expense, "id" | "description" | "amount" | "currency" | "category" | "date" | "paidById"> & {
    group: { id: string; name: string } | null;
    splits: { userId: string; amount: number }[];
  })[];
  settlements: Pick<Settlement, "id" | "fromUserId" | "toUserId" | "amount" | "currency" | "note" | "createdAt">[];
}

/** Shared history and balance with one person. */
export function useFriendDetail(id: string) {
  return useQuery<FriendDetail>({
    queryKey: ["friends", "detail", id],
    queryFn: () => fetchJSON(`/api/friends/${id}`),
    enabled: !!id,
  });
}
