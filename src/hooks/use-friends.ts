"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Friendship } from "@/types";

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

export function usePendingFriendRequests() {
  return useQuery<any[]>({
    queryKey: ["friends", "pending"],
    queryFn: () => fetchJSON("/api/friends?pending=true"),
  });
}

export function useSentFriendRequests() {
  return useQuery<any[]>({
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
