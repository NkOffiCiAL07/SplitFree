"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatCompactCurrency, cn } from "@/lib/utils";
import type { GroupStats } from "@/lib/group-stats";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD: "🍔", TRANSPORT: "🚗", ACCOMMODATION: "🏨", ENTERTAINMENT: "🎭",
  UTILITIES: "💡", SHOPPING: "🛒", HEALTH: "💊", TRAVEL: "✈️", EDUCATION: "📚", OTHER: "📦",
};

interface Props {
  stats?: GroupStats;
  /** userId → display name, for the "who paid most" list */
  names: Record<string, string>;
  currentUserId?: string;
}

/** Group spending summary: totals, category split and who paid most. */
export function GroupStatsCard({ stats, names, currentUserId }: Props) {
  if (!stats || stats.expenseCount === 0) return null;
  const { currency } = stats;
  const maxCategory = Math.max(...stats.byCategory.map((c) => c.total), 1);
  const topPayers = stats.byMember.filter((m) => m.paid > 0).slice(0, 3);

  return (
    <Card data-testid="group-stats">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Group spending</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total spent", value: stats.total },
            { label: "Your share", value: stats.yourShare },
            { label: "You paid", value: stats.yourPaid },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/50 p-2">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="text-sm font-bold" title={formatCurrency(value, currency)}>{formatCompactCurrency(value, currency)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {stats.byCategory.slice(0, 5).map((c) => (
            <div key={c.category} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center">{CATEGORY_EMOJI[c.category] ?? "📦"}</span>
              <span className="w-24 truncate capitalize">{c.category.toLowerCase()}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(c.total / maxCategory) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-muted-foreground">{formatCompactCurrency(c.total, currency)}</span>
            </div>
          ))}
        </div>

        {topPayers.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Paid the most:{" "}
            {topPayers.map((m, i) => (
              <span key={m.userId} className={cn(m.userId === currentUserId && "font-semibold text-foreground")}>
                {i > 0 && ", "}
                {m.userId === currentUserId ? "You" : names[m.userId] ?? "Someone"} ({formatCompactCurrency(m.paid, currency)})
              </span>
            ))}
          </div>
        )}

        {stats.otherCurrencies.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Also spent in other currencies:{" "}
            {stats.otherCurrencies.map((o) => formatCompactCurrency(o.total, o.currency)).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
