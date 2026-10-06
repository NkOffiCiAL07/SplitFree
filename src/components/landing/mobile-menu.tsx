"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export interface MenuLink { href: string; label: string }

/** The navigation on small screens: a hamburger that opens a short list (closes on a tap, on Escape, and when the page scrolls to a section). */
export function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-lg border border-current/15 transition-colors hover:bg-current/5"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Menu"
          data-testid="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-slate-200/70 bg-[#f5f7fb] px-4 pb-4 pt-2 shadow-lg dark:border-white/10 dark:bg-[#0b0c12]"
        >
          <ul className="mx-auto flex max-w-6xl flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/5">{l.label}</a>
              </li>
            ))}
            <li className="mt-2 flex gap-2 px-1">
              <Link href="/login" className="flex-1 rounded-xl border border-slate-300 py-2.5 text-center text-sm font-semibold text-slate-800 dark:border-white/20 dark:text-white">Sign in</Link>
              <Link href="/signup" className="flex-1 rounded-xl bg-[#5b57e8] py-2.5 text-center text-sm font-semibold text-white dark:bg-[#7c72ff] dark:text-slate-950">Get started</Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
