import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { getRates } from "@/lib/rates";
import { prisma } from "@/lib/prisma";
import { makeConverter, type Converter } from "@/lib/convert-core";

export * from "@/lib/convert-core";

/** The user's home currency (falls back to the app default). */
export async function homeCurrencyOf(userId: string): Promise<string> {
  const p = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  return p?.currency ?? DEFAULT_CURRENCY;
}

/**
 * Converter for a request. Fetches rates only when `needed` (some amount isn't in the home currency), waiting at most
 * `timeoutMs` so a slow rate service can't hold a screen up.
 */
export async function loadConverter(home: string, needed: boolean, timeoutMs = 800): Promise<Converter> {
  if (!needed) return makeConverter(home, null);
  return makeConverter(home, await getRates(home, { timeoutMs }));
}
