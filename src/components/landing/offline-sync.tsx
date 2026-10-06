import { WifiOff, Check, Wifi } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

/** "Your money, wherever you go": a phone that loses signal, saves an expense on the device, then syncs it once. Pure CSS loop. */
export function OfflineSync() {
  return (
    <section aria-labelledby="offline-sync-title" className="px-4 py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <p className="mb-2 text-sm font-medium text-violet-600 dark:text-violet-400">Your groups, in your pocket</p>
          <h2 id="offline-sync-title" className="mb-3 text-3xl font-bold sm:text-4xl">Your money, wherever you go.</h2>
          <p className="mx-auto max-w-md text-muted-foreground lg:mx-0">No signal on the trip? Add the bill anyway. It is saved on your phone, and the moment you are back online it syncs — once, never twice.</p>
        </div>

        <Reveal className="mx-auto w-full max-w-[17rem]">
          <div data-testid="offline-sync" className="relative rounded-[2.25rem] border-[6px] border-slate-900 bg-white p-4 shadow-2xl shadow-indigo-500/20 dark:border-slate-700 dark:bg-[#12151f]">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-900/80 dark:bg-slate-600" aria-hidden="true" />
            <div className="relative mb-3 h-9">
              <span className="os-offline absolute inset-0 flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <WifiOff className="size-3.5" aria-hidden="true" /> Offline — saved on this phone
              </span>
              <span className="os-online absolute inset-0 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Wifi className="size-3.5" aria-hidden="true" /> Back online — <Check className="size-3.5" aria-hidden="true" /> synced
              </span>
            </div>
            <ul className="space-y-2 text-sm">
              {[["🍔", "Dinner"], ["🚗", "Cab to the hotel"], ["☕", "Coffee stop"]].map(([e, t], i) => (
                <li key={t} className="flex items-center gap-2.5 rounded-xl border p-2.5">
                  <span aria-hidden="true">{e}</span>
                  <span className="flex-1 truncate font-medium">{t}</span>
                  {i === 2 ? (
                    <span className="relative size-4">
                      <span className="os-offline absolute inset-0 rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden="true" />
                      <Check className="os-online absolute inset-0 size-4 text-emerald-500" aria-hidden="true" />
                    </span>
                  ) : (
                    <Check className="size-4 text-emerald-500" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Added with no signal. Synced exactly once.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
