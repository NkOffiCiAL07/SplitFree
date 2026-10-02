"use client";

import { LazyMotion } from "framer-motion";

// Animation features load as a separate async chunk instead of blocking first paint.
// domMax (not domAnimation) because the nav indicators use layoutId.
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
