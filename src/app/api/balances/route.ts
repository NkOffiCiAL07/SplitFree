import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { loadUserLedger, loadPeople } from "@/lib/ledger-db";
import { pairNets, groupNets } from "@/lib/ledger";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { homeCurrencyOf, loadConverter, sumInHome, type Converter } from "@/lib/convert";

/** Largest absolute balance becomes the headline; every non-zero currency is listed in `all`. */
function summarise(nets: Map<string, number>, conv: Converter) {
  const all = [...nets.entries()]
    .filter(([, net]) => net !== 0)
    .map(([currency, net]) => ({ currency, net }))
    .sort((a, b) => Math.abs(conv.toHome(b.net, b.currency) ?? 0) - Math.abs(conv.toHome(a.net, a.currency) ?? 0));
  const head = all[0] ?? { currency: [...nets.keys()][0] ?? DEFAULT_CURRENCY, net: 0 };
  // With balances in several currencies, also give one overall figure in the home currency (approximate)
  let inHome: { currency: string; net: number; complete: boolean; approximate: boolean } | null = null;
  if (all.length > 1 || (all.length === 1 && all[0].currency !== conv.home)) {
    const t = sumInHome(all.map((x) => ({ amount: x.net, currency: x.currency })), conv);
    inHome = { currency: conv.home, net: t.total, complete: t.complete, approximate: t.approximate };
  }
  return { net: head.net, currency: head.currency, all, inHome };
}

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    // Balances come from the shared ledger, so multi-payer expenses and settlements are handled
    // identically everywhere. Amounts in different currencies are never added together.
    const { edges } = await loadUserLedger(userId);
    const home = await homeCurrencyOf(userId);
    const conv = await loadConverter(home, edges.some((e) => e.currency !== home));
    const people = await loadPeople([...pairNets(edges, userId).keys()]);

    const byPerson = Object.fromEntries(
      [...pairNets(edges, userId).entries()].map(([id, nets]) => {
        const p = people.get(id);
        return [id, { name: p?.name ?? "Unknown", avatarUrl: p?.avatarUrl ?? null, ...summarise(nets, conv) }];
      })
    );
    const byGroup = Object.fromEntries(
      [...groupNets(edges, userId).entries()].map(([id, nets]) => [id, summarise(nets, conv)])
    );

    const res = ok({ byPerson, byGroup });
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
