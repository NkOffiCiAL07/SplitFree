"use client";

import { useSyncExternalStore } from "react";
import { ChevronDown, Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildUpiAppLinks, buildUpiLink } from "@/lib/settle-tools";
import { detectPlatform, type Platform } from "@/lib/platform";

interface Props {
  /** Payee's saved UPI ID */
  vpa?: string | null;
  payeeName?: string;
  /** Amount in paise */
  amountCents: number;
  currency: string;
  note?: string;
  className?: string;
}

const noop = () => () => {};
const usePlatform = () =>
  useSyncExternalStore<Platform>(noop, () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints), () => "android");

/**
 * One-tap "Pay via UPI". On Android the system offers your UPI apps; on iPhone (which has no such chooser) a small
 * menu opens Google Pay / PhonePe / Paytm directly, with a copy-UPI-ID fallback. Renders nothing unless it's a rupee
 * payment to someone who has saved a valid UPI ID.
 */
export function UpiPayLink({ vpa, payeeName, amountCents, currency, note, className }: Props) {
  const platform = usePlatform();
  if (currency !== "INR" || !vpa) return null;
  const href = buildUpiLink({ vpa, name: payeeName, amountCents, note });
  if (!href) return null;
  const btn = className ?? "h-7 gap-1 px-2 text-xs";

  if (platform === "ios") {
    const apps = buildUpiAppLinks({ vpa, name: payeeName, amountCents, note }) ?? [];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className={btn} aria-label={`Pay ${payeeName ?? "them"} via UPI`}>
            <Smartphone className="size-3" /> UPI <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {apps.map((a) => (
            <DropdownMenuItem key={a.id} asChild>
              <a href={a.url}>{a.label}</a>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onSelect={async () => {
              try { await navigator.clipboard.writeText(vpa.trim()); toast.success("UPI ID copied"); }
              catch { toast.error(`UPI ID: ${vpa.trim()}`); }
            }}
          >
            <Copy className="mr-2 size-3.5" /> Copy UPI ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button asChild size="sm" variant="outline" className={btn}>
      <a href={href} aria-label={`Pay ${payeeName ?? "them"} via UPI`}>
        <Smartphone className="size-3" /> UPI
      </a>
    </Button>
  );
}
