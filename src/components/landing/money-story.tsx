import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";

export interface StoryData { group: string; expense: string; people: string; result: string; before: number; after: number }

/** The whole product in five beats: create, add, split, calculate, settle. */
export function MoneyStory({ s, card }: { s: StoryData; card?: ReactNode }) {
  const beats = [
    { n: "01", title: "Create a group", body: s.group },
    { n: "02", title: "Add expenses", body: s.expense },
    { n: "03", title: "Split", body: s.people },
    { n: "04", title: "Splitr calculates", body: s.result },
    { n: "05", title: "Settle", body: `${s.after} payments instead of ${s.before}` },
  ];
  return (
    <section aria-label="The money story" className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="mb-2 text-sm font-medium text-violet-600 dark:text-violet-400">The whole trip, in five steps</p>
            <h2 className="text-3xl font-bold sm:text-4xl">From messy to settled</h2>
            <p className="mt-3 max-w-md text-muted-foreground">Trips get messy. Your money doesn&apos;t have to.</p>
          </div>
          {card && <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-700 px-14 py-10">{card}</div>}
        </div>
        <ol data-testid="money-story" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {beats.map((b, i) => (
            <Reveal key={b.n} delay={i * 90}>
              <li className="relative h-full list-none rounded-2xl border bg-card p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="bg-gradient-to-br from-indigo-600 to-violet-500 bg-clip-text text-3xl font-extrabold text-transparent">{b.n}</span>
                <h3 className="mt-2 font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
