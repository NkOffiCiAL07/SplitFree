import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while the page is being rendered on the server and during hydration, true afterwards. Use it for anything that
 * can only be known in the browser (the saved theme, the visitor's clock): rendering it on the very first pass makes the
 * server HTML and the browser disagree, and React then throws the server HTML away and starts over (hydration error #418).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
