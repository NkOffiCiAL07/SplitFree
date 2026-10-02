"use client";

import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildUpiLink } from "@/lib/settle-tools";

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

/**
 * One-tap "Pay via UPI": opens GPay / PhonePe / Paytm with the payee and amount pre-filled.
 * Renders nothing unless it's a rupee payment to someone who has saved a valid UPI ID.
 */
export function UpiPayLink({ vpa, payeeName, amountCents, currency, note, className }: Props) {
  if (currency !== "INR" || !vpa) return null;
  const href = buildUpiLink({ vpa, name: payeeName, amountCents, note });
  if (!href) return null;
  return (
    <Button asChild size="sm" variant="outline" className={className ?? "h-7 gap-1 px-2 text-xs"}>
      <a href={href} aria-label={`Pay ${payeeName ?? "them"} via UPI`}>
        <Smartphone className="size-3" /> UPI
      </a>
    </Button>
  );
}
