"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchProfile() {
  const res = await fetch("/api/profile");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserCurrency(): string {
  const { data } = useProfile();
  return data?.currency ?? "USD";
}
