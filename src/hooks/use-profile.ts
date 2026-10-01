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

async function fetchDashboard() {
  const res = await fetch("/api/dashboard");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

// Shares the same ["dashboard"] cache — no extra network call
export function useUserCurrency(): string {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    select: (d: any) => d?.currency ?? "USD",
  });
  return (data as string | undefined) ?? "USD";
}
