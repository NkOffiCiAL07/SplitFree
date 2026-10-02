import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { loadUserLedger, loadPeople } from "@/lib/ledger-db";
import { pairNets, groupNets } from "@/lib/ledger";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

/** Largest absolute balance becomes the headline; every non-zero currency is listed in `all`. */
function summarise(nets: Map<string, number>) {
  const all = [...nets.entries()]
    .filter(([, net]) => net !== 0)
    .map(([currency, net]) => ({ currency, net }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const head = all[0] ?? { currency: [...nets.keys()][0] ?? DEFAULT_CURRENCY, net: 0 };
  return { net: head.net, currency: head.currency, all };
}

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    // Balances come from the shared ledger, so multi-payer expenses and settlements are handled
    // identically everywhere. Amounts in different currencies are never added together.
    const { edges } = await loadUserLedger(userId);
    const people = await loadPeople([...pairNets(edges, userId).keys()]);

    const byPerson = Object.fromEntries(
      [...pairNets(edges, userId).entries()].map(([id, nets]) => {
        const p = people.get(id);
        return [id, { name: p?.name ?? "Unknown", avatarUrl: p?.avatarUrl ?? null, ...summarise(nets) }];
      })
    );
    const byGroup = Object.fromEntries(
      [...groupNets(edges, userId).entries()].map(([id, nets]) => [id, summarise(nets)])
    );

    const res = ok({ byPerson, byGroup });
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
