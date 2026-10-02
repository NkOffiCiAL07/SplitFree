"use client";

import { useQuery } from "@tanstack/react-query";

interface PersonBalance {
  name: string;
  avatarUrl: string | null;
  net: number;
  currency: string;
}

interface GroupBalance {
  net: number;
  currency: string;
}

interface BalancesData {
  byPerson: Record<string, PersonBalance>;
  byGroup: Record<string, GroupBalance>;
}

async function fetchBalances(): Promise<BalancesData> {
  const res = await fetch("/api/balances");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useBalances() {
  return useQuery<BalancesData>({
    queryKey: ["balances"],
    queryFn: fetchBalances,
    staleTime: 30_000,
  });
}
