"use client";

import { useQuery } from "@tanstack/react-query";

export interface CurrencyNet { currency: string; net: number }

interface PersonBalance {
  name: string;
  avatarUrl: string | null;
  /** Headline balance: the currency with the largest absolute amount */
  net: number;
  currency: string;
  /** Every non-zero balance, one entry per currency */
  all: CurrencyNet[];
}

interface GroupBalance {
  net: number;
  currency: string;
  all: CurrencyNet[];
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
