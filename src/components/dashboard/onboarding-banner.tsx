"use client";

import { useState, useSyncExternalStore } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X, Users, UserPlus, Receipt, ArrowRight, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const ALL_STEPS = [
  {
    id: "group" as const,
    icon: Users,
    title: "Create your first group",
    description: "Organize expenses by trip, household, or any shared activity.",
    action: "Create group",
    href: "/groups",
    color: "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400",
  },
  {
    id: "friend" as const,
    icon: UserPlus,
    title: "Add friends",
    description: "Connect with friends so you can split expenses together.",
    action: "Add friend",
    href: "/friends",
    color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    id: "expense" as const,
    icon: Receipt,
    title: "Log your first expense",
    description: `Add an expense and ${APP_NAME} will calculate who owes what.`,
    action: "Add expense",
    href: "/expenses",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
];

const STORAGE_KEY = "splitfree_onboarding_dismissed";

/** `done` says which of the three things the person has already done (left out while that is still loading): only the rest are suggested. */
export function OnboardingBanner({ done }: { done?: { group: boolean; friend: boolean; expense: boolean } }) {
  const STEPS = done ? ALL_STEPS.filter((s) => !done[s.id]) : ALL_STEPS;
  // localStorage is only readable on the client; the server snapshot says "already dismissed"
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try { return localStorage.getItem(STORAGE_KEY); } catch { return "1"; }
    },
    () => "1"
  );
  const [hidden, setHidden] = useState(false);
  const visible = !stored && !hidden && STEPS.length > 0;
  const [step, setStep] = useState(0);
  const router = useRouter();

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setHidden(true);
  };

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  if (!current) return null;
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, height: 0 }}
          transition={{ duration: 0.25 }}
          className="relative rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 overflow-hidden"
        >
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Getting started · {step + 1}/{STEPS.length}
              </span>
            </div>
            <button
              onClick={dismiss}
              className="-m-2.5 shrink-0 p-2.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <m.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="mt-4 flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${current.color}`}>
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{current.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{current.description}</p>
              </div>
            </m.div>
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="brand"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                router.push(current.href);
                if (step === STEPS.length - 1) dismiss();
              }}
            >
              {current.action} <ArrowRight className="size-3.5" />
            </Button>

            {step < STEPS.length - 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step + 1)}>
                Skip
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Done
              </Button>
            )}

            {/* Dots */}
            <div className="ml-auto flex gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to step ${i + 1} of ${STEPS.length}`}
                  onClick={() => setStep(i)}
                  className="-mx-1 -my-2 flex h-7 items-center px-3"
                >
                  <span className={`block h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-primary" : "w-1.5 bg-primary/30"}`} />
                </button>
              ))}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
