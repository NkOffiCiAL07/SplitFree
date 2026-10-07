"use client";

import { useEffect, useState } from "react";
import { Check, Home, Receipt, Signal, UserPlus, Users, Wifi, WifiOff, BatteryFull, BatteryFull as Battery } from "lucide-react";
import { BrandMark } from "@/components/shared/brand-logo";

export interface PhoneSample {
  owed: string; owe: string;
  people: { name: string; note: string; amount: string; tone: string; bg: string }[];
  recent: { emoji: string; name: string; share: string; tone: string; amount: string }[];
  received: string; trip: string;
  payments: { from: string; to: string; amount: string }[];
  payChip: string;
  bill: { title: string; total: string; shares: { name: string; amount: string }[] };
}

type Tab = "home" | "settle" | "split";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Balances" },
  { id: "settle", label: "Settle up" },
  { id: "split", label: "Split a bill" },
];
const TINTS = ["bg-rose-400", "bg-emerald-500", "bg-indigo-500", "bg-amber-500"];

/**
 * A little interactive demo of the app: tap a tab (or just wait — it rotates on its own until you touch it) and the phone
 * screen changes. The phone is decoration; the tabs below it are real, keyboard-friendly buttons.
 */
export function PhoneDemo({ s }: { s: PhoneSample }) {
  const [tab, setTab] = useState<Tab>("home");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTab((t) => TABS[(TABS.findIndex((x) => x.id === t) + 1) % TABS.length].id), 5200);
    return () => clearInterval(id);
  }, [auto]);

  const choose = (t: Tab) => { setAuto(false); setTab(t); };

  return (
    <div className="mx-auto w-[260px] sm:w-[290px]">
      <div className="relative" aria-hidden="true">
        <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-violet-500/30 via-indigo-500/20 to-fuchsia-500/20 blur-3xl" />

        {/* Phone body: titanium-style frame, side buttons, real 9:19.5 proportions */}
        <div className="relative rounded-[2.9rem] border-[7px] border-zinc-900 bg-zinc-900 shadow-[0_40px_90px_-20px_rgba(76,29,149,0.55)] dark:border-zinc-700 dark:bg-zinc-700">
          <span className="absolute -left-[10px] top-24 h-9 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
          <span className="absolute -left-[10px] top-40 h-14 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
          <span className="absolute -left-[10px] top-[14.5rem] h-14 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
          <span className="absolute -right-[10px] top-36 h-20 w-[3px] rounded-r bg-zinc-800 dark:bg-zinc-600" />

          {/* the phone screen has its own colours: it must not inherit the (white) text colour of the dark hero around it */}
          <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.3rem] bg-background text-foreground">
            <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[10px] font-semibold">
              <span>9:41</span>
              <span className="absolute left-1/2 top-2.5 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-black" />
              <span className="flex items-center gap-1"><Signal className="size-3" /><Wifi className="size-3" /><Battery className="size-3.5" /></span>
            </div>

            <div key={tab} className="anim-fade-in flex min-h-0 flex-1 flex-col gap-2.5 px-3.5 pb-2 pt-3">
              {tab === "home" && <HomeScreen s={s} />}
              {tab === "settle" && <SettleScreen s={s} />}
              {tab === "split" && <SplitScreen s={s} />}
            </div>

            <div className="border-t bg-background/95 px-3 pb-1.5 pt-1.5">
              <div className="flex items-center justify-around text-[8px] text-muted-foreground">
                {[
                  { icon: Home, label: "Home", active: tab === "home" },
                  { icon: Users, label: "Groups", active: tab === "settle" },
                  { icon: Receipt, label: "Expenses", active: tab === "split" },
                  { icon: UserPlus, label: "Friends", active: false },
                ].map(({ icon: Icon, label, active }) => (
                  <div key={label} className={`flex flex-col items-center gap-0.5 ${active ? "text-[#4f48e6] dark:text-[#8b83ff]" : ""}`}>
                    <Icon className="size-4" />
                    <span className={active ? "font-semibold" : ""}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-zinc-900/80 dark:bg-zinc-200/80" />
            </div>
          </div>
        </div>

        {/* floating cards: dark glass, white text (the hero behind them is dark) */}
        <div className="anim-float lg-glass-dark absolute -left-[132px] top-24 hidden rounded-2xl px-3 py-2 sm:block">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold"><Check className="size-3.5 text-emerald-300" /> Payment received</p>
          <p className="text-[10px] text-white/80">{s.received}</p>
        </div>
        <div className="anim-float-slow lg-glass-dark absolute -right-[130px] top-64 hidden rounded-2xl px-3 py-2 sm:block">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold"><WifiOff className="size-3.5 text-violet-200" /> Offline — saved</p>
          <p className="text-[10px] text-white/80">Syncs when you&apos;re back</p>
        </div>
        <div className="anim-float lg-glass-dark absolute -left-[118px] bottom-28 hidden rounded-2xl px-3 py-2 sm:block">
          <p className="text-[11px] font-semibold">10 payments → 3</p>
          <p className="text-[10px] text-white/80">Debts simplified</p>
        </div>
      </div>

      <div role="tablist" aria-label="See the app in action" className="lg-glass-dark mx-auto mt-8 flex w-fit max-w-full rounded-full p-1 text-xs font-semibold text-white">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => choose(id)}
            className={`rounded-full px-3.5 py-2.5 transition-colors ${tab === id ? "bg-white text-violet-700 shadow" : "text-white/85 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeScreen({ s }: { s: PhoneSample }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] text-muted-foreground">Good evening</p>
          <p className="text-[13px] font-bold leading-tight">Your balances</p>
        </div>
        <BrandMark size={28} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-2">
          <p className="text-[8px] text-muted-foreground">Owed to you</p>
          <p className="text-[15px] font-bold leading-tight text-[#0b7a4f] dark:text-emerald-400">{s.owed}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2">
          <p className="text-[8px] text-muted-foreground">You owe</p>
          <p className="text-[15px] font-bold leading-tight text-[#c4243b] dark:text-rose-400">{s.owe}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-1.5">
        <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Balances</p>
        {s.people.map((r) => (
          <div key={r.name} className="flex items-center gap-2 py-1">
            <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${r.bg}`}>{r.name[0]}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium leading-tight">{r.name}</p>
              <p className="text-[8.5px] leading-tight text-muted-foreground">{r.note}</p>
            </div>
            <p className={`text-[11px] font-semibold ${r.tone}`}>{r.amount}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-1.5">
        <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Recent</p>
        {s.recent.map((e) => (
          <div key={e.name} className="flex items-center gap-2 py-1">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[12px]">{e.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-medium leading-tight">{e.name}</p>
              <p className={`text-[8.5px] leading-tight ${e.tone}`}>{e.share}</p>
            </div>
            <p className="text-[10.5px] font-semibold">{e.amount}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto rounded-xl gradient-brand py-2 text-center text-[11px] font-semibold text-white">Settle up</div>
    </>
  );
}

function SettleScreen({ s }: { s: PhoneSample }) {
  return (
    <>
      <div>
        <p className="text-[9px] text-muted-foreground">{s.trip}</p>
        <p className="text-[13px] font-bold leading-tight">Settle up</p>
      </div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5">
        <p className="text-[9px] font-semibold text-[#4f48e6] dark:text-[#a5a0ff]">Simplified for the whole group</p>
        <p className="text-[15px] font-bold leading-tight">{s.payments.length} payments</p>
        <p className="text-[8.5px] text-muted-foreground">instead of one for every expense</p>
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-1.5">
        {s.payments.map((p, i) => (
          <div key={p.from} className="flex items-center gap-2 border-b py-1.5 last:border-0">
            <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${TINTS[i % TINTS.length]}`}>{p.from[0]}</div>
            <p className="min-w-0 flex-1 truncate text-[10.5px] leading-tight"><b className="font-semibold">{p.from}</b> pays <b className="font-semibold">{p.to}</b></p>
            <p className="text-[10.5px] font-semibold text-[#c4243b] dark:text-rose-400">{p.amount}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-2 text-[9px] text-muted-foreground">
        Pay with <b className="font-semibold text-foreground">{s.payChip}</b>, or record it — the balance clears.
      </div>
      <div className="mt-auto rounded-xl gradient-brand py-2 text-center text-[11px] font-semibold text-white">Mark as paid</div>
    </>
  );
}

function SplitScreen({ s }: { s: PhoneSample }) {
  return (
    <>
      <div>
        <p className="text-[9px] text-muted-foreground">New expense</p>
        <p className="text-[13px] font-bold leading-tight">Add expense</p>
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-2">
        <p className="text-[8px] text-muted-foreground">Description</p>
        <p className="text-[11px] font-medium">{s.bill.title}</p>
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-2">
        <p className="text-[8px] text-muted-foreground">Amount</p>
        <p className="text-[20px] font-bold leading-tight tabular-nums">{s.bill.total}</p>
      </div>
      <div className="rounded-xl border bg-card px-2.5 py-1.5">
        <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Split equally</p>
        {s.bill.shares.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2 py-1">
            <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${TINTS[i % TINTS.length]}`}>{p.name[0]}</div>
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium">{p.name}</p>
            <p className="text-[11px] font-semibold tabular-nums">{p.amount}</p>
          </div>
        ))}
      </div>
      <p className="text-[8.5px] text-muted-foreground">Shares always add up exactly.</p>
      <div className="mt-auto rounded-xl gradient-brand py-2 text-center text-[11px] font-semibold text-white">Add expense</div>
    </>
  );
}
