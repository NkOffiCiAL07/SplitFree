"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";

/**
 * Turns a heavy, `open`-controlled dialog into one that is code-split: its code is fetched, and the
 * component mounted, only once `open` first becomes true (it then stays mounted so it can animate closed).
 * Keeps forms and their libraries out of the first load of every page that merely *can* open them.
 */
export function lazyControlledDialog<P extends { open?: boolean }>(loader: () => Promise<ComponentType<P>>) {
  const Dialog = dynamic(loader as () => Promise<ComponentType<Record<string, unknown>>>, { ssr: false });
  return function LazyDialog(props: P) {
    const [everOpened, setEverOpened] = useState(false);
    if (props.open && !everOpened) setEverOpened(true);
    return everOpened ? <Dialog {...(props as Record<string, unknown>)} /> : null;
  };
}
