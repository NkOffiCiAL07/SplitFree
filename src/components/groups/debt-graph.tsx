"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GraphPerson { id: string; name: string }
export interface GraphDebt { fromUserId: string; toUserId: string; amount: number; currency: string }

interface Props {
  people: GraphPerson[];
  debts: GraphDebt[];
  meId?: string;
  /** "₹2,400" for (240000, "INR") */
  format: (amount: number, currency: string) => string;
  /** Called when "Pay" is pressed on a payment the signed-in person owes */
  onPay?: (debt: GraphDebt) => void;
  /** Where to look at the expenses between you and someone (a person's page) */
  personHref?: (userId: string) => string;
}

const TINTS = ["#c4b5fd", "#7dd3fc", "#fcd34d", "#86efac", "#f9a8d4", "#fdba74", "#a5b4fc", "#5eead4", "#fda4af", "#d9f99d", "#93c5fd", "#e9d5ff"];
const MAX_PEOPLE = 12;
const C = 150; // centre of the 300×300 canvas
const NODE_R = 19;

const key = (d: GraphDebt) => `${d.fromUserId}>${d.toUserId}`;

/**
 * Money between friends as a picture: people are circles on a ring, each payment is a glowing dashed arrow from the person
 * who pays to the person who gets paid (thicker = more money; red = you pay, green = you receive). Tap a person or an arrow
 * to light it up and read what it means. Built from the SAME simplified payments as the list, so it can never disagree.
 */
export function DebtGraph({ people, debts, meId, format, onPay, personHref }: Props) {
  const uid = useId().replace(/:/g, "");
  const currencies = useMemo(() => [...new Set(debts.map((d) => d.currency))], [debts]);
  const [chosen, setChosen] = useState<string | null>(null);
  const currency = chosen && currencies.includes(chosen) ? chosen : currencies[0];
  const shown = useMemo(() => debts.filter((d) => d.currency === currency && d.amount > 0), [debts, currency]);
  const [sel, setSel] = useState<{ kind: "edge" | "node"; id: string } | null>(null);

  const nameOf = (id: string) => (id === meId ? "You" : people.find((p) => p.id === id)?.name ?? "Someone");
  const involved = useMemo(() => {
    const ids = [...new Set(shown.flatMap((d) => [d.fromUserId, d.toUserId]))];
    return ids.sort((a, b) => (a === meId ? -1 : b === meId ? 1 : 0)); // you first (top of the ring)
  }, [shown, meId]);

  if (shown.length === 0) return null;
  if (involved.length > MAX_PEOPLE) {
    return <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">This group is too big to draw clearly — use the list view.</p>;
  }

  const n = involved.length;
  const radius = n <= 2 ? 88 : 104;
  const pos = new Map(involved.map((id, i) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [id, { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a), angle: a }];
  }));
  const max = Math.max(...shown.map((d) => d.amount));

  const colourOf = (d: GraphDebt) => (d.fromUserId === meId ? "#ef4444" : d.toUserId === meId ? "#22c55e" : "#a78bfa");
  const markerOf = (d: GraphDebt) => (d.fromUserId === meId ? "out" : d.toUserId === meId ? "in" : "other");

  const geometry = (d: GraphDebt) => {
    const a = pos.get(d.fromUserId)!, b = pos.get(d.toUserId)!;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = a.x + ux * (NODE_R + 2), sy = a.y + uy * (NODE_R + 2);
    const ex = b.x - ux * (NODE_R + 5), ey = b.y - uy * (NODE_R + 5);
    // bend each arrow to one side, so two people who owe each other (in different currencies) never overlap
    const bend = len * 0.16;
    const cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend;
    return { path: `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, mx: 0.25 * sx + 0.5 * cx + 0.25 * ex, my: 0.25 * sy + 0.5 * cy + 0.25 * ey };
  };

  const isActiveEdge = (d: GraphDebt) => !sel || (sel.kind === "edge" ? sel.id === key(d) : d.fromUserId === sel.id || d.toUserId === sel.id);
  const selectedDebt = sel?.kind === "edge" ? shown.find((d) => key(d) === sel.id) : undefined;
  const selectedNode = sel?.kind === "node" ? sel.id : undefined;
  const onKey = (action: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); } };

  return (
    <div data-testid="debt-graph" className="space-y-3">
      {currencies.length > 1 && (
        <div role="tablist" aria-label="Currency" className="flex flex-wrap gap-1.5">
          {currencies.map((c) => (
            <button key={c} role="tab" type="button" aria-selected={c === currency} onClick={() => { setChosen(c); setSel(null); }} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", c === currency ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>{c}</button>
          ))}
        </div>
      )}

      <div className="relative mx-auto aspect-square w-full max-w-[22rem] rounded-3xl border bg-gradient-to-br from-violet-50 via-background to-sky-50 p-1 dark:from-violet-950/30 dark:to-sky-950/20">
        <svg viewBox="0 0 300 300" className="size-full" role="group" aria-label={`Who pays whom: ${shown.length} payment${shown.length === 1 ? "" : "s"} between ${n} people`} onClick={() => setSel(null)}>
          <defs>
            {(["out", "in", "other"] as const).map((m) => (
              <marker key={m} id={`${uid}-${m}`} viewBox="0 0 8 8" refX="6" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0 L8 4 L0 8 z" fill={m === "out" ? "#ef4444" : m === "in" ? "#22c55e" : "#a78bfa"} />
              </marker>
            ))}
          </defs>

          {shown.map((d) => {
            const g = geometry(d);
            const active = isActiveEdge(d);
            const stroke = 1.3 + 2.7 * (d.amount / max);
            const label = format(d.amount, d.currency);
            const w = Math.max(24, label.length * 5.4 + 8);
            const choose = () => setSel({ kind: "edge", id: key(d) });
            return (
              <g
                key={key(d)}
                data-edge={key(d)}
                data-active={active || undefined}
                role="button"
                tabIndex={0}
                aria-label={`${nameOf(d.fromUserId)} ${d.fromUserId === meId ? "pay" : "pays"} ${nameOf(d.toUserId)} ${label}`}
                aria-pressed={sel?.kind === "edge" && sel.id === key(d)}
                className="cursor-pointer outline-none focus-visible:[&_.edge-line]:stroke-[5px]"
                style={{ opacity: active ? 1 : 0.16, transition: "opacity .25s" }}
                onClick={(e) => { e.stopPropagation(); choose(); }}
                onKeyDown={onKey(choose)}
              >
                <path d={g.path} fill="none" stroke="transparent" strokeWidth="16" /* a wide, invisible target so thin lines are easy to tap */ />
                <path d={g.path} className="debt-flow edge-line" fill="none" stroke={colourOf(d)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray="5 4" markerEnd={`url(#${uid}-${markerOf(d)})`} style={{ filter: `drop-shadow(0 0 3px ${colourOf(d)}88)` }} />
                <rect x={g.mx - w / 2} y={g.my - 6.5} width={w} height="13" rx="6.5" className="fill-background" stroke={colourOf(d)} strokeOpacity="0.5" strokeWidth="0.6" />
                <text x={g.mx} y={g.my + 2.6} textAnchor="middle" fontSize="7" fontWeight="700" className="fill-foreground">{label}</text>
              </g>
            );
          })}

          {involved.map((id, i) => {
            const p = pos.get(id)!;
            const name = nameOf(id);
            const below = Math.sin(p.angle) > -0.2;
            const choose = () => setSel({ kind: "node", id });
            const ring = id === meId;
            return (
              <g
                key={id}
                data-node={id}
                data-me={ring || undefined}
                role="button"
                tabIndex={0}
                aria-label={`${name}: ${shown.filter((d) => d.fromUserId === id).length} to pay, ${shown.filter((d) => d.toUserId === id).length} to receive`}
                aria-pressed={selectedNode === id}
                className="cursor-pointer outline-none"
                onClick={(e) => { e.stopPropagation(); choose(); }}
                onKeyDown={onKey(choose)}
              >
                {ring && <circle cx={p.x} cy={p.y} r={NODE_R + 4} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="2 2" />}
                <circle cx={p.x} cy={p.y} r={NODE_R} fill={TINTS[i % TINTS.length]} stroke={selectedNode === id ? "#7c3aed" : "#ffffff"} strokeWidth={selectedNode === id ? 2.5 : 2} />
                <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#18181b">{name[0]?.toUpperCase()}</text>
                <text x={p.x} y={below ? p.y + NODE_R + 11 + (ring ? 5 : 0) : p.y - NODE_R - 5 - (ring ? 7 : 0)} textAnchor="middle" fontSize="8" fontWeight="600" className="fill-foreground">{name.length > 11 ? `${name.slice(0, 10)}…` : name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div aria-live="polite" className="min-h-[3.5rem] rounded-xl border bg-card p-3 text-sm">
        {selectedDebt ? (
          <div data-testid="debt-detail" className="space-y-2">
            <p><b>{nameOf(selectedDebt.fromUserId)}</b> {selectedDebt.fromUserId === meId ? "pay" : "pays"} <b>{nameOf(selectedDebt.toUserId)}</b> <b className="tabular-nums">{format(selectedDebt.amount, selectedDebt.currency)}</b></p>
            <p className="text-xs text-muted-foreground">This is what is left after everyone&apos;s expenses and payments in the group are netted together.</p>
            <div className="flex flex-wrap gap-2">
              {selectedDebt.fromUserId === meId && onPay && (
                <button type="button" onClick={() => onPay(selectedDebt)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Pay {nameOf(selectedDebt.toUserId)} <ArrowRight className="size-3.5" /></button>
              )}
              {personHref && (selectedDebt.fromUserId === meId || selectedDebt.toUserId === meId) && (
                <Link href={personHref(selectedDebt.fromUserId === meId ? selectedDebt.toUserId : selectedDebt.fromUserId)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent">See the expenses between you <ArrowRight className="size-3.5" /></Link>
              )}
            </div>
          </div>
        ) : selectedNode ? (
          <div data-testid="debt-detail" className="space-y-1">
            <p className="font-semibold">{nameOf(selectedNode)}</p>
            {shown.filter((d) => d.fromUserId === selectedNode).map((d) => <p key={key(d)} className="text-red-600 dark:text-red-400">pays {nameOf(d.toUserId)} {format(d.amount, d.currency)}</p>)}
            {shown.filter((d) => d.toUserId === selectedNode).map((d) => <p key={key(d)} className="text-green-600 dark:text-green-400">gets {format(d.amount, d.currency)} from {nameOf(d.fromUserId)}</p>)}
          </div>
        ) : (
          <p className="text-muted-foreground">Tap a person or an arrow. <span className="text-red-500">Red</span> is what you pay, <span className="text-green-600">green</span> is what you receive.</p>
        )}
      </div>
    </div>
  );
}
