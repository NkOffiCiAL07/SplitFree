import Link from "next/link";
import { ArrowRight, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/shared/brand-logo";
import { Reveal } from "@/components/landing/reveal";

const STEPS = [
  { n: "1", t: "Export from Splitwise", d: "In Splitwise, export your account as a CSV file." },
  { n: "2", t: "Upload it here", d: "Drop the file in. We read every expense, payment and balance." },
  { n: "3", t: "Match your friends", d: "Confirm who is who — then you carry on exactly where you left off." },
];

/** A dedicated callout for people switching from Splitwise (one of the strongest reasons to come over). */
export function SplitwiseBanner() {
  return (
    <section id="from-splitwise" aria-labelledby="from-splitwise-title" className="px-4 py-20">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-violet-200/70 bg-gradient-to-br from-white via-violet-50 to-sky-50 p-8 shadow-xl shadow-violet-500/10 dark:border-white/10 dark:from-zinc-900 dark:via-violet-950/40 dark:to-sky-950/30 sm:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">Switching apps?</p>
            <h2 id="from-splitwise-title" className="text-balance text-3xl font-bold sm:text-4xl">Coming from Splitwise? Bring your whole history.</h2>
            <p className="mt-3 max-w-md text-muted-foreground">Import your Splitwise export and keep every group, every expense and every balance — nothing to re-enter, no one to chase.</p>
            <ol className="mt-6 space-y-3">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{s.n}</span>
                  <span className="text-sm"><b className="font-semibold">{s.t}</b> <span className="text-muted-foreground">— {s.d}</span></span>
                </li>
              ))}
            </ol>
            <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:bg-violet-700">
              Sign in and import your history <ArrowRight className="size-4" />
            </Link>
          </div>

          <div aria-hidden="true" className="relative mx-auto flex w-full max-w-sm items-center justify-between gap-3">
            <div className="lg-float flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 shadow-lg">
              <FileSpreadsheet className="size-10 text-emerald-600" />
              <span className="text-[11px] font-medium text-muted-foreground">splitwise-export.csv</span>
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5">
              {[0, 1, 2, 3].map((i) => <span key={i} className="size-2 animate-pulse rounded-full bg-violet-500" style={{ animationDelay: `${i * 0.22}s` }} />)}
            </div>
            <div className="lg-float-2 relative flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 shadow-lg">
              <BrandMark size={40} />
              <span className="text-[11px] font-medium text-muted-foreground">Splitr Pro</span>
              <CheckCircle2 className="absolute -right-2 -top-2 size-6 rounded-full bg-background text-emerald-500" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
