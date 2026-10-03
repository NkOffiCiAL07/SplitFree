"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface FillState { level: number; setLevel: (n: number) => void }
const FillContext = createContext<FillState>({ level: 0, setLevel: () => {} });

/** Shares the form's progress (0..1) between the sign-in form and the pot drawn beside it. */
export function FillProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState(0);
  return <FillContext.Provider value={{ level, setLevel }}>{children}</FillContext.Provider>;
}

export const useFillLevel = () => useContext(FillContext).level;

/** Called by a form with its current progress; the pot empties again when the form goes away. */
export function useReportFill(level: number) {
  const { setLevel } = useContext(FillContext);
  useEffect(() => { setLevel(level); }, [level, setLevel]);
  useEffect(() => () => setLevel(0), [setLevel]);
}
