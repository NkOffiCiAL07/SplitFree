import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

export interface ShowcaseData {
  line1: string; line2: string; kicker: string;
  trip: { name: string; emoji: string; total: string; people: number; youGet: string };
  dinner: { name: string; emoji: string; owe: string };
  before: number; after: number;
}

/** A floating translucent card (the same glass everywhere on this page) */
const glass = "showcase-card rounded-3xl border border-white/10 bg-white/[0.055] shadow-[0_25px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl backdrop-saturate-[150%]";

/** The left side of the desktop sign-in: the product story and three floating, real-looking Splitr cards. Decorative; the motion is slow and stops for reduced-motion. */
export function AuthShowcase({ d }: { d: ShowcaseData }) {
  return (
    <aside data-testid="auth-showcase" className="relative isolate hidden overflow-hidden bg-[#08090d] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_35%,rgba(99,91,255,0.20),transparent_38%),radial-gradient(circle_at_65%_78%,rgba(34,211,238,0.08),transparent_32%),linear-gradient(180deg,#08090d,#0d0f16)]" />

      <BrandLogo size={30} tone="light" />

      <div className="max-w-xl">
        <h2 className="text-balance text-5xl font-bold leading-[1.02] tracking-tight xl:text-7xl">
          {d.line1}{" "}
          <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">{d.line2}</span>
        </h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-[#a1a7b5]">Your trips, dinners and everyday expenses — beautifully sorted.</p>
        <p className="mt-2 text-sm text-[#6f7585]">{d.kicker}</p>
      </div>

      <div aria-hidden="true" data-testid="showcase-cards" className="showcase-stage relative h-[22rem] w-full max-w-lg">
        <div className={`${glass} anim-float-slow absolute bottom-8 right-10 w-52 rotate-2 scale-95 p-4 opacity-90`}>
          <p className="text-sm font-semibold">{d.dinner.name} <span>{d.dinner.emoji}</span></p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-white/50">You owe</p>
          <p className="text-2xl font-bold text-[#fb7185]">{d.dinner.owe}</p>
        </div>

        <div className={`${glass} anim-float absolute bottom-0 left-0 flex items-center gap-2 -rotate-1 scale-95 px-4 py-3 text-sm opacity-90`}>
          <span aria-hidden="true">✨</span><b>Smart settle-up</b>
          <span className="ml-2 flex items-center gap-1.5 text-white/70">{d.before} payments <ArrowRight className="size-3.5 text-violet-300" /> <b className="text-violet-300">{d.after}</b></span>
        </div>

        <div className={`${glass} anim-float-slow absolute left-4 top-0 w-72 -rotate-2 p-6`} style={{ animationDelay: "-2s" }}>
          <p className="text-sm font-semibold">{d.trip.name} <span>{d.trip.emoji}</span></p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight">{d.trip.total}</p>
          <p className="text-xs text-[#a1a7b5]">{d.trip.people} people</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[11px] uppercase tracking-wide text-white/50">You get</p>
            <p className="text-3xl font-extrabold text-[#34d399]">+ {d.trip.youGet}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The phone version: one slim card under the headline (the form stays the priority) */
export function AuthMobileHero({ d }: { d: ShowcaseData }) {
  return (
    <section data-testid="auth-mobile-hero" aria-label="Splitr" className="px-6 pb-2 pt-2 lg:hidden">
      <h2 className="text-balance text-[2.1rem] font-bold leading-[1.05] tracking-tight text-white">
        {d.line1}{" "}
        <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">{d.line2}</span>
      </h2>
      <div aria-hidden="true" className={`${glass} mt-4 flex items-center justify-between px-4 py-3 [@media(max-height:700px)]:hidden`}>
        <span className="text-sm font-semibold">{d.trip.name} {d.trip.emoji}<span className="block text-xs font-normal text-[#a1a7b5]">{d.trip.total} · {d.trip.people} people</span></span>
        <span className="text-right"><span className="block text-[10px] uppercase tracking-wide text-white/50">You get</span><b className="text-lg text-[#34d399]">+ {d.trip.youGet}</b></span>
      </div>
    </section>
  );
}
