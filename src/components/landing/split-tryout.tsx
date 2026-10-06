"use client";

import { useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents } from "@/lib/utils";

const NAMES = ["You", "Asha", "Rohan", "Mia", "Liam", "Noah", "Ava", "Kabir", "Zoya", "Ethan"];
const TINTS = ["from-violet-400 to-fuchsia-400", "from-sky-400 to-cyan-300", "from-amber-300 to-orange-400", "from-emerald-300 to-teal-400", "from-pink-400 to-rose-300", "from-indigo-400 to-sky-300", "from-lime-300 to-emerald-300", "from-fuchsia-400 to-purple-400", "from-cyan-300 to-blue-400", "from-orange-300 to-amber-300"];

/**
 * A live, honest demo: the shares come from the SAME function the app uses to save an expense, so the little leftover
 * cent really lands where it would in the app and the shares always add up exactly.
 */
export function SplitTryout({ symbol = "₹", defaultAmount = "2400", currency = "INR" }: { symbol?: string; defaultAmount?: string; currency?: string }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [people, setPeople] = useState(4);

  const cents = toCents(parseFloat(amount) || 0);
  const valid = cents > 0 && cents <= 100_000_000;
  const shares = valid ? Object.values(calculateSplits(cents, NAMES.slice(0, people), "EQUAL")) : null;
  const max = shares ? Math.max(...shares) : 1;
  const fmt = (c: number) => `${symbol}${(c / 100).toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

  return (
    <div data-testid="split-tryout" className="lg-glass-dark relative w-full max-w-xl rounded-3xl p-5 text-left text-white sm:p-6">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
        <Sparkles className="size-3.5 text-amber-300" aria-hidden="true" /> Try it — split a bill
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[9rem] flex-1">
          <span className="mb-1 block text-xs text-white/70">Bill total</span>
          <span className="flex items-center rounded-2xl bg-white/10 px-4 ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-white/60">
            <span className="text-xl font-semibold text-white/80" aria-hidden="true">{symbol}</span>
            <input
              inputMode="decimal"
              aria-label="Bill total"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 10))}
              className="h-14 w-full bg-transparent px-2 text-3xl font-bold tabular-nums outline-none placeholder:text-white/30"
              placeholder="0"
            />
          </span>
        </label>

        <div>
          <span className="mb-1 block text-xs text-white/70">Friends</span>
          <div className="flex h-14 items-center gap-1 rounded-2xl bg-white/10 px-1.5 ring-1 ring-white/20">
            <button type="button" aria-label="Fewer people" disabled={people <= 2} onClick={() => setPeople((n) => Math.max(2, n - 1))} className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-white/15 disabled:opacity-30">
              <Minus className="size-4" />
            </button>
            <output aria-live="polite" aria-label="Number of people" className="w-8 text-center text-2xl font-bold tabular-nums">{people}</output>
            <button type="button" aria-label="More people" disabled={people >= 10} onClick={() => setPeople((n) => Math.min(10, n + 1))} className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-white/15 disabled:opacity-30">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2" aria-label="Each person's share">
        {shares ? shares.map((c, i) => (
          <li key={NAMES[i]} className="flex items-center gap-3 text-sm">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${TINTS[i]} text-[11px] font-bold text-zinc-900`}>{NAMES[i][0]}</span>
            <span className="w-14 shrink-0 text-white/80">{NAMES[i]}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${TINTS[i]} transition-[width] duration-500 ease-out`} style={{ width: `${Math.max(8, (c / max) * 100)}%` }} />
            </span>
            <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{fmt(c)}</span>
          </li>
        )) : (
          <li className="py-3 text-center text-sm text-white/60">Type an amount to see the split</li>
        )}
      </ul>

      <p className="mt-4 text-xs text-white/60">
        {shares ? <>Adds up to exactly <b className="text-white/90">{fmt(cents)}</b> — never a cent lost or invented.</> : "Splits always add up exactly."}
      </p>
    </div>
  );
}
