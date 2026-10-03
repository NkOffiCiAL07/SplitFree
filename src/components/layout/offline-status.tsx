"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOutbox } from "@/hooks/use-outbox";
import { flushOutbox } from "@/lib/offline/outbox";
import { formatCurrency } from "@/lib/utils";

const RETRY_MS = 30_000;

/**
 * Offline banner + background sync. Shows when the device is offline (data on screen is the last saved copy) or
 * while saved changes are being sent; replays the outbox whenever the connection is back.
 */
export function OfflineStatus() {
  const online = useOnlineStatus();
  const queue = useOutbox();
  const pending = queue.filter((i) => i.status !== "failed"); // failed ones wait for the user, not for the network
  const failedCount = queue.length - pending.length;
  const qc = useQueryClient();
  const count = pending.length;

  const sync = useCallback(async () => {
    const result = await flushOutbox();
    if (result.synced.length > 0) {
      for (const root of ["expenses", "settlements", "dashboard", "analytics", "balance", "balances", "friends", "groups", "activity"]) {
        qc.invalidateQueries({ queryKey: [root] });
      }
      toast.success(result.synced.length === 1 ? "Your offline change is synced" : `${result.synced.length} offline changes synced`);
    }
    for (const { item, message } of result.failed) {
      toast.error(`Couldn't sync "${item.label}" (${formatCurrency(Math.round(item.amount * 100), item.currency)}): ${message}. It's kept on the Expenses page.`);
    }
    return result;
  }, [qc]);

  // Replay when we come online (and on load), and keep retrying if the server is unreachable
  useEffect(() => {
    if (!online || count === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const run = async () => {
      const result = await sync().catch(() => null);
      if (!stopped && (!result || result.offline)) timer = setTimeout(run, RETRY_MS);
    };
    run();
    return () => { stopped = true; clearTimeout(timer); };
  }, [online, count, sync]);

  if (online && count === 0 && failedCount === 0) return null;

  return (
    <div
      role="status"
      className={
        "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium " +
        (online && count === 0 ? "bg-destructive/10 text-destructive" : online ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200")
      }
    >
      {online && count > 0 ? <RefreshCw className="size-3.5 animate-spin" /> : online ? <AlertTriangle className="size-3.5" /> : <CloudOff className="size-3.5" />}
      {online && count > 0
        ? `Syncing ${count} offline ${count === 1 ? "change" : "changes"}…`
        : online
          ? `${failedCount} offline ${failedCount === 1 ? "change needs" : "changes need"} your attention — see Expenses`
          : count > 0
            ? `You're offline — ${count} ${count === 1 ? "change is" : "changes are"} saved and will sync automatically`
            : "You're offline — showing your last saved data. You can still add expenses and payments."}
    </div>
  );
}
