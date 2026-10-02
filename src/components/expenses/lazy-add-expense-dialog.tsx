"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import type { AddExpenseDialog as AddExpenseDialogType } from "./add-expense-dialog";

type Props = ComponentProps<typeof AddExpenseDialogType>;

const loadDialog = () => import("./add-expense-dialog").then((m) => m.AddExpenseDialog);
// The form (react-hook-form, zod, Radix selects…) is ~90 KB gzipped, and nobody sees it until they click
// "Add expense" — so it's fetched on demand instead of with every page that can open it.
const AddExpenseDialog = dynamic(loadDialog, { ssr: false });

/** Warms the chunk so the dialog opens instantly when the user is about to click. */
export const preloadAddExpenseDialog = () => void loadDialog();

/**
 * Drop-in for AddExpenseDialog that code-splits it. Works both ways the dialog is used:
 *  - controlled (`open` / `onOpenChange`): mounts the dialog the first time `open` becomes true;
 *  - with a trigger (`children`): renders the trigger now and mounts the dialog on first click.
 */
export function LazyAddExpenseDialog({ children, open: controlledOpen, onOpenChange, ...rest }: Props) {
  // Fetch the chunk once the browser is idle (after the page is interactive) so the first click is instant,
  // without it counting against the page's first load.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(preloadAddExpenseDialog) : window.setTimeout(preloadAddExpenseDialog, 1500);
    return () => { if (!idle) window.clearTimeout(id); };
  }, []);

  const [internalOpen, setInternalOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;

  if (open && !everOpened) setEverOpened(true);

  const setOpen = (next: boolean) => {
    if (next) setEverOpened(true);
    if (controlled) onOpenChange?.(next);
    else {
      setInternalOpen(next);
      onOpenChange?.(next);
    }
  };

  return (
    <>
      {!controlled && children && (
        // `display: contents` keeps the trigger's layout exactly as if it were rendered directly
        <span className="contents" onClick={() => setOpen(true)} onPointerEnter={preloadAddExpenseDialog} onFocus={preloadAddExpenseDialog}>
          {children}
        </span>
      )}
      {everOpened && <AddExpenseDialog {...rest} open={open} onOpenChange={setOpen} />}
    </>
  );
}
