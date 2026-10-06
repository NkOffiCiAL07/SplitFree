export interface TripCardData { name: string; emoji: string; total: string; people: number; youGet: string; from: string }

/** A floating group card for the hero: big number, tiny supporting text, a second card tucked behind it for depth. */
export function TripCard({ t }: { t: TripCardData }) {
  return (
    <div data-testid="trip-card" className="relative w-60 rotate-[-6deg] select-none">
      <div aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 rotate-[7deg] rounded-3xl border border-white/10 bg-white/5" />
      <div className="relative rounded-3xl border border-white/15 bg-white/10 p-5 text-white shadow-2xl shadow-black/30 lg-glass-dark">
        <p className="text-sm font-semibold">{t.name} <span aria-hidden="true">{t.emoji}</span></p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight">{t.total}</p>
        <p className="text-xs text-white/60">total · {t.people} people</p>
        <div className="mt-4 rounded-2xl bg-emerald-400/15 p-3 ring-1 ring-emerald-300/25">
          <p className="text-[11px] uppercase tracking-wide text-emerald-200/80">You get</p>
          <p className="text-2xl font-extrabold text-emerald-300">{t.youGet}</p>
          <p className="text-[11px] text-white/55">{t.from}</p>
        </div>
      </div>
    </div>
  );
}
