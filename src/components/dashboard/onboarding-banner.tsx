"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, UserPlus, Receipt, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    icon: Users,
    title: "Create your first group",
    description: "Organize expenses by trip, household, or any shared activity.",
    action: "Create group",
    href: "/groups",
    color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    icon: UserPlus,
    title: "Add friends",
    description: "Connect with friends so you can split expenses together.",
    action: "Add friend",
    href: "/friends",
    color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    icon: Receipt,
    title: "Log your first expense",
    description: "Add an expense and SplitFree will calculate who owes what.",
    action: "Add expense",
    href: "/expenses",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
];

const STORAGE_KEY = "splitfree_onboarding_dismissed";

export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
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
            </motion.div>
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
                  onClick={() => setStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? "bg-primary w-4" : "bg-primary/30"}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
