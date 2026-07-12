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
