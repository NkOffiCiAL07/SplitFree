import { Reveal } from "@/components/landing/reveal";

export interface ChatLine { who: string; text: string }
export interface Moment { emoji: string; title: string; meta: string; example: string; net: string; tone: "get" | "owe" }

/** "Still doing this in the group chat?" — the problem, in the messages everyone has sent. */
export function ChatProblem({ lines, answer }: { lines: ChatLine[]; answer: string }) {
  return (
    <section aria-label="The problem" className="px-4 py-16 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-[#4f48e6] dark:text-[#8b83ff]">Sound familiar?</p>
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Still doing this in the group chat?</h2>
          <p className="text-muted-foreground">{answer}</p>
        </div>
        <ul data-testid="chat-problem" className="space-y-2.5">
          {lines.map((l, i) => (
            <Reveal key={l.text} as="li" delay={i * 110} className={`max-w-[85%] list-none rounded-2xl px-4 py-2.5 text-sm shadow-sm ${i % 2 ? "ml-auto rounded-br-sm bg-[#4f48e6] text-white" : "rounded-bl-sm bg-muted"}`}>
              <span className={`block text-[11px] font-semibold ${i % 2 ? "text-white/80" : "text-muted-foreground"}`}>{l.who}</span>
              {l.text}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Real-life money moments as small product cards: what it was, how many, and what it means for you (green = you get, red = you owe). Hover or focus shows a tiny example. */
export function MomentsGrid({ moments }: { moments: Moment[] }) {
  return (
    <section aria-label="Real-life money moments" className="px-4 pb-16 sm:pb-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Made for real-life money moments</h2>
        </div>
        <ul data-testid="moments" className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
          {moments.map((m, i) => (
            <Reveal key={m.title} as="li" delay={(i % 3) * 70} className="list-none">
              <div tabIndex={0} className="group relative list-none rounded-2xl border bg-card p-3.5 outline-none sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-violet-500">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-xl sm:size-11 sm:text-2xl" aria-hidden="true">{m.emoji}</span>
                  <span className="text-right">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{m.tone === "get" ? "You get" : "You owe"}</span>
                    <b className={`text-base tabular-nums sm:text-lg ${m.tone === "get" ? "text-[#0b7a4f] dark:text-emerald-400" : "text-[#c4243b] dark:text-rose-400"}`}>{m.net}</b>
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold sm:text-base">{m.title}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{m.meta}</p>
                <p className="mt-2 hidden text-xs text-muted-foreground sm:block">{m.example}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
