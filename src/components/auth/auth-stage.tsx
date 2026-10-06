"use client";

import { useState } from "react";

type Stage = "idle" | "email" | "password" | "leaving";

/**
 * Wraps the whole sign-in page and tells the floating cards what the person is doing, through one data attribute:
 * email focused → the cards come a little closer and brighter; password focused → they soften (privacy);
 * the form submitted → they drift away. Any later focus puts them back. Purely visual.
 */
export function AuthStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  return (
    <div
      data-stage={stage}
      className={className}
      onFocusCapture={(e) => {
        const id = (e.target as HTMLElement).id;
        setStage(id === "email" ? "email" : id === "password" ? "password" : "idle");
      }}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setStage((s) => (s === "leaving" ? s : "idle")); }}
      onSubmitCapture={() => setStage("leaving")}
    >
      {children}
    </div>
  );
}
