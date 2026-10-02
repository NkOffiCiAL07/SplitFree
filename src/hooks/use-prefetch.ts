"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchForPath } from "@/lib/prefetch";

/** Event props that preload a destination's data when the user shows intent (hover, focus, touch). */
export function usePrefetchOnIntent() {
  const qc = useQueryClient();
  return useCallback(
    (href: string) => {
      const go = () => prefetchForPath(qc, href);
      return { onMouseEnter: go, onFocus: go, onTouchStart: go };
    },
    [qc]
  );
}
