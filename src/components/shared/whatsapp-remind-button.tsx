"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { buildReminderMessage, whatsappShareUrl } from "@/lib/invite";
import { formatCurrency } from "@/lib/utils";

/**
 * "Remind on WhatsApp": opens WhatsApp with a polite, specific message (amount, and your UPI ID for rupee debts)
 * ready to send. Works for anyone — they don't need the app or notifications. `amount` is in stored units.
 */
export function WhatsAppRemindButton({ debtorName, amount, currency, className }: {
  debtorName?: string;
  amount: number;
  currency: string;
  className?: string;
}) {
  const { data: profile } = useProfile();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className ?? "h-7 gap-1 text-xs"}
      aria-label={`Remind ${debtorName ?? "them"} on WhatsApp`}
      onClick={() => {
        // Built on click (not render) so nothing differs between server and client
        const text = buildReminderMessage({
          debtorName,
          amountLabel: formatCurrency(amount, currency),
          currency,
          upiId: (profile as { upiId?: string | null } | undefined)?.upiId,
        });
        window.open(whatsappShareUrl(text), "_blank", "noopener,noreferrer");
      }}
    >
      <MessageCircle className="size-3 text-green-600" /> WhatsApp
    </Button>
  );
}
