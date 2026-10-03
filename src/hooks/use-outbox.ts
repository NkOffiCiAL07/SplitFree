"use client";

import { useSyncExternalStore } from "react";
import { pendingItems, subscribeOutbox, type OutboxItem } from "@/lib/offline/outbox";

const EMPTY: OutboxItem[] = [];

/** The current user's writes that are saved on this device and waiting to sync. */
export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribeOutbox, pendingItems, () => EMPTY);
}
