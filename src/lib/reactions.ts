/** The few emoji people can react with (a fixed set: nothing free-form is stored). */
export const REACTIONS = ["🍕", "🍻", "💸", "💀", "😂", "👍", "❤️", "🔥"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface ReactionSummary { emoji: string; count: number; mine: boolean }

/** Counts per emoji (in the picker's order, only emoji someone used) and which of them are the signed-in person's. */
export function summarizeReactions(rows: { emoji: string; userId: string }[], meId: string): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.userId === meId) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  return REACTIONS.filter((e) => byEmoji.has(e)).map((emoji) => ({ emoji, ...byEmoji.get(emoji)! }));
}
