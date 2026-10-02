import { requireAuth, ok, handleError } from "@/lib/api-helpers";
import { loadUserLedger, loadPeople } from "@/lib/ledger-db";
import { pairNets } from "@/lib/ledger";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    const { edges } = await loadUserLedger(userId);
    const nets = pairNets(edges, userId); // other → currency → net (+ they owe me)

    const people = await loadPeople([...nets.keys()]);
    const unknown = (id: string) => ({ id, name: "Unknown", avatarUrl: null });

    // Each currency is simplified on its own so rupees never cancel dollars
    const currencies = new Set([...nets.values()].flatMap((m) => [...m.keys()]));
    const simplified = [...currencies].flatMap((currency) => {
      const rawDebts = [...nets.entries()]
        .map(([otherId, byCurrency]) => [otherId, byCurrency.get(currency) ?? 0] as const)
        .filter(([, amt]) => amt !== 0)
        .map(([otherId, amt]) =>
          amt < 0
            ? { fromUserId: userId, toUserId: otherId, amount: -amt }
            : { fromUserId: otherId, toUserId: userId, amount: amt }
        );
      return simplifyDebts(rawDebts).map((d) => ({
        ...d,
        currency,
        fromUser: people.get(d.fromUserId) ?? unknown(d.fromUserId),
        toUser: people.get(d.toUserId) ?? unknown(d.toUserId),
      }));
    });

    const res = ok({ simplified });
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res;
  } catch (e) {
    return handleError(e);
  }
}
