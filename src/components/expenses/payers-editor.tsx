"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { evenPayerAmounts, payersRemainingCents, type PayerAmounts } from "@/lib/payers";

interface Member { userId: string; name: string }

interface Props {
  members: Member[];
  currentUserId?: string;
  /** Total of the expense in major units (what the payers must add up to) */
  total: number;
  currency: string;
  paidById: string;
  onPaidByChange: (id: string) => void;
  multiple: boolean;
  onMultipleChange: (multiple: boolean) => void;
  amounts: PayerAmounts;
  onAmountsChange: (amounts: PayerAmounts) => void;
}

/** "Paid by": one person (chips) or several people with an amount each (must add up to the total). */
export function PayersEditor({
  members, currentUserId, total, currency, paidById, onPaidByChange, multiple, onMultipleChange, amounts, onAmountsChange,
}: Props) {
  const remaining = payersRemainingCents(total, amounts);
  const label = (m: Member) => (m.userId === currentUserId ? "You" : m.name.split(" ")[0]);

  const toggle = () => {
    const next = !multiple;
    onMultipleChange(next);
    // Start multi-payer mode with the total split evenly, so the sum is valid straight away
    if (next && Object.keys(amounts).length === 0) onAmountsChange(evenPayerAmounts(total, members.map((m) => m.userId)));
  };

  return (
    <div className="space-y-2" data-testid="payers-editor">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Paid by</span>
        <button
          type="button"
          onClick={toggle}
          className={cn("flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 transition-colors",
            multiple ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}
          aria-pressed={multiple}
        >
          <Users className="size-3" /> Multiple payers
        </button>
      </div>

      {!multiple ? (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.userId}
              type="button"
              onClick={() => onPaidByChange(m.userId)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all",
                paidById === m.userId ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <Avatar className="size-4"><AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback></Avatar>
              {label(m)}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{label(m)}</span>
              <Input
                aria-label={`Amount paid by ${label(m)}`}
                type="number" step="0.01" min="0" placeholder="0.00"
                className="w-28 h-8 text-sm"
                value={amounts[m.userId] ?? ""}
                onChange={(e) => onAmountsChange({ ...amounts, [m.userId]: e.target.value })}
              />
            </div>
          ))}
          <p
            role="status"
            className={cn("text-xs", remaining === 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}
          >
            {remaining === 0
              ? "Payers add up to the total ✓"
              : remaining > 0
                ? `${formatCurrency(remaining, currency)} still to assign`
                : `${formatCurrency(-remaining, currency)} over the total`}
          </p>
        </div>
      )}
    </div>
  );
}
