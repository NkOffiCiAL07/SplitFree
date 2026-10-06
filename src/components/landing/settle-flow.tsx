import { Reveal } from "@/components/landing/reveal";

// Five friends on a ring. "Before": every debt is its own payment (10 arrows). "After": the same money moves in 3 payments.
const NODES = [
  { name: "Asha", x: 50, y: 8, tint: "#c4b5fd" },
  { name: "Rohan", x: 90, y: 38, tint: "#7dd3fc" },
  { name: "Mia", x: 75, y: 88, tint: "#fcd34d" },
  { name: "Liam", x: 25, y: 88, tint: "#86efac" },
  { name: "Noah", x: 10, y: 38, tint: "#f9a8d4" },
];
const BEFORE: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
const AFTER: [number, number][] = [[4, 0], [3, 1], [2, 1]];

const line = (a: number, b: number) => ({ x1: NODES[a].x, y1: NODES[a].y, x2: NODES[b].x, y2: NODES[b].y });

/** "Ten payments become three": a looping, purely visual explanation (no numbers to get wrong). Still shows the end state without motion. */
export function SettleFlow({ noun = "payments" }: { noun?: string }) {
  return (
    <section aria-labelledby="settle-flow-title" className="auth-canvas relative isolate overflow-hidden px-4 py-24 text-white">
      <div aria-hidden="true" className="auth-dots pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-cyan-200">
            <span className="h-px w-4 bg-cyan-200/50" /> Smart settle-up
          </p>
          <h2 id="settle-flow-title" className="text-balance text-3xl font-bold sm:text-5xl">
            Ten {noun} become <span className="lg-text-shimmer bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">three.</span>
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/75">
            Everyone owes everyone a little. Splitr works out who really needs to pay whom, so a whole trip settles in a handful of transfers — not a group chat full of reminders.
          </p>
        </Reveal>

        <Reveal delay={150} className="mx-auto w-full max-w-sm">
          <figure className="lg-glass-dark relative aspect-square rounded-[2rem] p-3" aria-label="Diagram: ten payments between five friends become three">
            <svg viewBox="0 0 100 100" className="size-full overflow-visible" role="img" aria-hidden="true">
              <defs>
                <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#a5f3fc" /></marker>
              </defs>
              <g className="settle-before" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.5">
                {BEFORE.map(([a, b]) => <line key={`${a}-${b}`} {...line(a, b)} />)}
              </g>
              <g className="settle-after" stroke="#a5f3fc" strokeWidth="1.4" strokeLinecap="round" markerEnd="url(#arrow)">
                {AFTER.map(([a, b], i) => <line key={`${a}-${b}`} {...line(a, b)} pathLength={1} style={{ animationDelay: `${i * 0.35}s` }} />)}
              </g>
              {NODES.map((n) => (
                <g key={n.name}>
                  <circle cx={n.x} cy={n.y} r="7.2" fill={n.tint} />
                  <text x={n.x} y={n.y + 2.2} textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#18181b">{n.name[0]}</text>
                </g>
              ))}
            </svg>
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <span className="settle-caption-before lg-glass-dark rounded-full px-3 py-1 text-xs font-medium">10 payments</span>
              <span className="settle-caption-after absolute rounded-full bg-cyan-200 px-3 py-1 text-xs font-bold text-zinc-900">3 payments</span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
