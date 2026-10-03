import { prisma } from "@/lib/prisma";

interface ActivityLike {
  settlementId: string | null;
  metadata: unknown;
  expense?: { currency: string } | null;
}

/**
 * Activity amounts are stored without their currency. Work it out (from the metadata when present, else the linked
 * expense or settlement) so the feed never prints a rupee amount with a dollar sign. Unknown stays unknown: the
 * amount is then hidden rather than shown in a guessed currency.
 */
export async function withActivityCurrency<T extends ActivityLike>(activities: T[]): Promise<(T & { metadata: Record<string, unknown> })[]> {
  const metaOf = (a: T) => ((a.metadata && typeof a.metadata === "object" ? a.metadata : {}) as Record<string, unknown>);
  const needSettlement = activities.filter((a) => a.settlementId && !metaOf(a).currency && !a.expense).map((a) => a.settlementId as string);
  const settlements = needSettlement.length > 0
    ? await prisma.settlement.findMany({ where: { id: { in: [...new Set(needSettlement)] } }, select: { id: true, currency: true } })
    : [];
  const bySettlement = new Map(settlements.map((s) => [s.id, s.currency]));
  return activities.map((a) => {
    const meta = metaOf(a);
    const currency = (meta.currency as string | undefined) ?? a.expense?.currency ?? (a.settlementId ? bySettlement.get(a.settlementId) : undefined);
    return { ...a, metadata: currency ? { ...meta, currency } : meta };
  });
}
