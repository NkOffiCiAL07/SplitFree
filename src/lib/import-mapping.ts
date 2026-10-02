import type { SplitwiseRow } from "@/lib/splitwise-import";

export interface Candidate { id: string; name: string }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Suggests which app user each Splitwise name is. Matches the signed-in user by name (or the
 * Splitwise "You"), then exact full name, then first name, then a unique prefix. Never guesses
 * between two equally good candidates, and never maps two names to the same person automatically.
 */
export function suggestMapping(
  names: string[],
  candidates: Candidate[],
  me: { id: string; name?: string | null }
): Record<string, string> {
  const result: Record<string, string> = {};
  const taken = new Set<string>();
  const all = candidates.some((c) => c.id === me.id) ? candidates : [{ id: me.id, name: me.name ?? "You" }, ...candidates];

  const pick = (name: string): string | null => {
    const n = norm(name);
    if (n === "you" || (me.name && n === norm(me.name))) return me.id;
    const free = all.filter((c) => !taken.has(c.id));
    const tiers: ((c: Candidate) => boolean)[] = [
      (c) => norm(c.name) === n,
      (c) => norm(c.name).split(" ")[0] === n || n.split(" ")[0] === norm(c.name).split(" ")[0],
      (c) => norm(c.name).startsWith(n) || n.startsWith(norm(c.name)),
    ];
    for (const tier of tiers) {
      const hits = free.filter(tier);
      if (hits.length === 1) return hits[0].id;
      if (hits.length > 1) return null; // ambiguous — let the user choose
    }
    return null;
  };

  for (const name of names) {
    const id = pick(name);
    if (id) { result[name] = id; taken.add(id); }
  }
  return result;
}

/** Names that appear in at least one row (columns for people who never took part need no mapping). */
export function usedNames(rows: SplitwiseRow[]): string[] {
  return [...new Set(rows.flatMap((r) => Object.keys(r.nets)))];
}

/** Which of the used names still has no person chosen. */
export function unmappedNames(rows: SplitwiseRow[], mapping: Record<string, string>): string[] {
  return usedNames(rows).filter((n) => !mapping[n]);
}
