"use client";

import { useAuth } from "@/hooks/use-auth";
import { Zap, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function DemoBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  const isDemo = demoEmail && user?.email === demoEmail;

  if (!isDemo || dismissed) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-3 text-sm">
      <Zap className="size-4 shrink-0" />
      <span className="flex-1">
        You&apos;re viewing a <strong>demo account</strong> with sample data.{" "}
        <Link href="/signup" className="underline font-medium hover:opacity-80">Create your free account</Link> to get started.
      </span>
      <button onClick={() => setDismissed(true)} className="shrink-0 hover:opacity-80">
        <X className="size-4" />
      </button>
    </div>
  );
}
