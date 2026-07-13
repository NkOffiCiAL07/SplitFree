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

// Returns currency from dashboard (which prefers group currency over profile default)
async function fetchDashboardCurrency() {
  const res = await fetch("/api/dashboard");
  const json = await res.json();
  return json.data?.currency ?? "USD";
}

export function useUserCurrency(): string {
  const { data } = useQuery({
    queryKey: ["dashboard-currency"],
    queryFn: fetchDashboardCurrency,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? "USD";
}
