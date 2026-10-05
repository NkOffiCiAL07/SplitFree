"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Sign in | Create account switch at the top of the desktop card (phones have their own links at the bottom). Keeps ?redirect= so invite links survive. */
export function AuthTabs() {
  const pathname = usePathname() ?? "";
  const redirect = useSearchParams()?.get("redirect");
  const mode = pathname.startsWith("/signup") ? "signup" : pathname.startsWith("/login") ? "login" : null;
  if (!mode) return null;
  const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
  const tab = "relative z-10 rounded-xl py-2 text-center transition-colors";

  return (
    <nav aria-label="Account" data-testid="auth-tabs" className="relative mb-6 hidden grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-semibold lg:grid">
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-background shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out", mode === "signup" && "translate-x-full")}
      />
      <Link href={`/login${q}`} aria-current={mode === "login" ? "page" : undefined} className={cn(tab, mode === "login" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
        Sign in
      </Link>
      <Link href={`/signup${q}`} aria-current={mode === "signup" ? "page" : undefined} className={cn(tab, mode === "signup" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
        Create account
      </Link>
    </nav>
  );
}
