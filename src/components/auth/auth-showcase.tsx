import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

export interface ShowcaseData {
  line1: string; line2: string; kicker: string;
  trip: { name: string; emoji: string; total: string; people: number; youGet: string };
  dinner: { name: string; emoji: string; owe: string };
  before: number; after: number;
}

/** A floating translucent card (the same glass everywhere on this page) */
const glass = "showcase-card rounded-3xl border border-white/70 bg-white/60 text-[#11131a] shadow-[0_24px_70px_rgba(40,45,90,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-[150%] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_25px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.07)]";
const MUTED = "text-[#697083] dark:text-[#a1a7b5]";
const LABEL = "text-[#697083] dark:text-white/50";
const GET = "text-[#16a36a] dark:text-[#34d399]";
const OWE = "text-[#e5485d] dark:text-[#fb7185]";

/** The left side of the desktop sign-in: the product story and three floating, real-looking Splitr cards. Decorative; the motion is slow and stops for reduced-motion. */
export function AuthShowcase({ d }: { d: ShowcaseData }) {
  return (
    <aside data-testid="auth-showcase" className="relative hidden text-[#11131a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16 dark:text-white">

      <BrandLogo size={30} className="dark:hidden" />
      <BrandLogo size={30} tone="light" className="hidden dark:flex" />

      <div className="max-w-xl">
        <h2 className="text-balance text-5xl font-bold leading-[1.02] tracking-tight xl:text-7xl">
          {d.line1}{" "}
          <span className="block bg-gradient-to-r from-[#635bff] via-[#7c5cff] to-[#38bdf8] bg-clip-text dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-200 text-transparent">{d.line2}</span>
        </h2>
        <p className={`mt-5 max-w-md text-lg leading-relaxed ${MUTED}`}>Your trips, dinners and everyday expenses — beautifully sorted.</p>
        <p className="mt-2 text-sm text-[#697083] dark:text-[#6f7585]">{d.kicker}</p>
      </div>

      <div aria-hidden="true" data-testid="showcase-cards" className="showcase-stage relative h-[22rem] w-full max-w-lg">
        <div className={`${glass} anim-float-slow absolute bottom-8 right-10 w-52 rotate-2 scale-95 p-4 opacity-90`}>
          <p className="text-sm font-semibold">{d.dinner.name} <span>{d.dinner.emoji}</span></p>
          <p className={`mt-2 text-[11px] uppercase tracking-wide ${LABEL}`}>You owe</p>
          <p className={`text-2xl font-bold ${OWE}`}>{d.dinner.owe}</p>
        </div>

        <div className={`${glass} anim-float absolute bottom-0 left-0 flex items-center gap-2 -rotate-1 scale-95 px-4 py-3 text-sm opacity-90`}>
          <span aria-hidden="true">✨</span><b>Smart settle-up</b>
          <span className={`ml-2 flex items-center gap-1.5 ${MUTED}`}>{d.before} payments <ArrowRight className="size-3.5 text-[#635bff] dark:text-violet-300" /> <b className="text-[#635bff] dark:text-violet-300">{d.after}</b></span>
        </div>

        <div className={`${glass} anim-float-slow absolute left-4 top-0 w-72 -rotate-2 p-6`} style={{ animationDelay: "-2s" }}>
          <p className="text-sm font-semibold">{d.trip.name} <span>{d.trip.emoji}</span></p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight">{d.trip.total}</p>
          <p className={`text-xs ${MUTED}`}>{d.trip.people} people</p>
          <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
            <p className={`text-[11px] uppercase tracking-wide ${LABEL}`}>You get</p>
            <p className={`text-3xl font-extrabold ${GET}`}>+ {d.trip.youGet}</p>
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
      <h2 className="text-balance text-[2.1rem] font-bold leading-[1.05] tracking-tight text-[#11131a] dark:text-white [@media(max-height:700px)]:text-[1.7rem]">
        {d.line1}{" "}
        <span className="block bg-gradient-to-r from-[#635bff] via-[#7c5cff] to-[#38bdf8] bg-clip-text dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-200 text-transparent">{d.line2}</span>
      </h2>
      <div aria-hidden="true" className={`${glass} mt-4 flex items-center justify-between px-4 py-3 [@media(max-height:700px)]:hidden`}>
        <span className="text-sm font-semibold">{d.trip.name} {d.trip.emoji}<span className={`block text-xs font-normal ${MUTED}`}>{d.trip.total} · {d.trip.people} people</span></span>
        <span className="text-right"><span className={`block text-[10px] uppercase tracking-wide ${LABEL}`}>You get</span><b className={`text-lg ${GET}`}>+ {d.trip.youGet}</b></span>
      </div>
    </section>
  );
}
