"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AppleLogo } from "@/components/shared/apple-logo";

/** The iPhone block of the hero: instead of a dead "coming soon" box, people can leave an email and be told at launch. */
export function IosNotify() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, website: "" }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message ?? "Something went wrong");
      setState("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong — please try again");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div data-testid="ios-notify-done" role="status" className="lg-glass-dark flex items-center gap-3 rounded-2xl px-5 py-3 text-left text-white">
        <span className="flex size-8 items-center justify-center rounded-full bg-emerald-400 text-emerald-950"><Check className="size-4" /></span>
        <span className="text-sm leading-tight"><b className="block">You&apos;re on the list</b><span className="text-white/80">We&apos;ll email you when the iPhone app launches.</span></span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="ios-notify" className="lg-glass-dark relative flex w-full max-w-sm flex-col gap-2 rounded-2xl px-4 py-3 text-left text-white sm:w-[21rem]">
      <p className="flex items-center gap-2 text-sm font-semibold"><AppleLogo className="size-5 shrink-0 text-white/80" aria-hidden="true" /> iPhone &amp; iPad — get notified</p>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="ios-notify-email">Your email</label>
        <input
          id="ios-notify-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          className="h-10 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm text-white outline-none ring-1 ring-white/25 placeholder:text-white/50 focus:ring-2 focus:ring-white/70"
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={state === "sending"} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-3.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-white/90 disabled:opacity-70">
          {state === "sending" ? <Loader2 className="size-4 animate-spin" aria-label="Sending" /> : "Notify me"}
        </button>
      </div>
      {state === "error" && <p role="alert" className="text-xs text-rose-200">{message}</p>}
      <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow">SOON</span>
    </form>
  );
}
