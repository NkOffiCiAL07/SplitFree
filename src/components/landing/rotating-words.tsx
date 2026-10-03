"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through short phrases with a soft blur-in. Screen readers get the whole list once (not a flickering
 * announcement), and with "reduce motion" it simply shows the first phrase.
 */
export function RotatingWords({ words, intervalMs = 2600, className }: { words: string[]; intervalMs?: number; className?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), intervalMs);
    return () => clearInterval(t);
  }, [words.length, intervalMs]);

  return (
    <>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden="true" data-testid="rotating-word" className={className}>
        <span key={i} className="lg-word inline-block">{words[i]}</span>
      </span>
    </>
  );
}
