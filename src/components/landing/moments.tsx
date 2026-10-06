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

const SPOTS = [
  "md:left-1/2 md:top-0", "md:left-[86%] md:top-[24%]", "md:left-[86%] md:top-[74%]",
  "md:left-1/2 md:top-[96%]", "md:left-[14%] md:top-[74%]", "md:left-[14%] md:top-[24%]",
];

/** Real-life money moments: floating chips around one central balance; hovering (or focusing) a chip shows a tiny example. */
export function MomentsGrid({ moments, center }: { moments: Moment[]; center: { title: string; total: string; people: string } }) {
  return (
    <section aria-label="Real-life money moments" className="px-4 pb-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Made for real-life money moments</h2>
        </div>
        <div className="md:relative md:mt-16 md:h-[27rem]">
        <ul data-testid="moments" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:contents">
          {moments.map((m, i) => (
            <li
              key={m.title}
              tabIndex={0}
              style={{ animationDelay: `${i * 0.7}s` }}
              className={`group list-none rounded-2xl border border-white/70 bg-white/70 p-4 text-center shadow-sm outline-none backdrop-blur-xl transition-shadow duration-300 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-violet-500 md:absolute md:w-max md:-translate-x-1/2 md:-translate-y-1/2 anim-float-slow dark:border-white/10 dark:bg-white/5 ${SPOTS[i % SPOTS.length]}`}
            >
              <span className="text-2xl" aria-hidden="true">{m.emoji}</span>
              <p className="mt-1 text-sm font-semibold">{m.title}</p>
              <p className="mt-1 text-xs text-muted-foreground md:pointer-events-none md:absolute md:left-1/2 md:top-full md:z-10 md:mt-2 md:w-48 md:-translate-x-1/2 md:rounded-xl md:border md:bg-card md:p-2 md:opacity-0 md:shadow-lg md:transition-opacity md:duration-200 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">{m.example}</p>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="mt-6 md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2">
          <div data-testid="moments-center" className="mx-auto w-48 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-center text-white shadow-2xl shadow-indigo-500/30">
            <p className="text-xs font-medium text-white/75">{center.title}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{center.total}</p>
            <p className="text-xs text-white/70">{center.people}</p>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
