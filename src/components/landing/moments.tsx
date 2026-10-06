import { Reveal } from "@/components/landing/reveal";

export interface ChatLine { who: string; text: string }
export interface Moment { emoji: string; title: string; example: string }

/** "Still doing this in the group chat?" — the problem, in the messages everyone has sent. */
export function ChatProblem({ lines, answer }: { lines: ChatLine[]; answer: string }) {
  return (
    <section aria-label="The problem" className="px-4 py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-violet-600 dark:text-violet-400">Sound familiar?</p>
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Still doing this in the group chat?</h2>
          <p className="text-muted-foreground">{answer}</p>
        </div>
        <ul data-testid="chat-problem" className="space-y-2.5">
          {lines.map((l, i) => (
            <Reveal key={l.text} delay={i * 110}>
              <li className={`max-w-[85%] list-none rounded-2xl px-4 py-2.5 text-sm shadow-sm ${i % 2 ? "ml-auto rounded-br-sm bg-violet-600 text-white" : "rounded-bl-sm bg-muted"}`}>
                <span className={`block text-[11px] font-semibold ${i % 2 ? "text-white/70" : "text-muted-foreground"}`}>{l.who}</span>
                {l.text}
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Real-life money moments; hovering (or focusing) a card shows a tiny example. */
export function MomentsGrid({ moments }: { moments: Moment[] }) {
  return (
    <section aria-label="Real-life money moments" className="px-4 pb-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Made for real-life money moments</h2>
        </div>
        <ul data-testid="moments" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {moments.map((m) => (
            <li key={m.title} tabIndex={0} className="group relative list-none overflow-hidden rounded-2xl border bg-card p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-violet-500">
              <span className="text-3xl" aria-hidden="true">{m.emoji}</span>
              <p className="mt-2 font-semibold">{m.title}</p>
              <p className="mt-1 text-xs text-muted-foreground transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">{m.example}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
