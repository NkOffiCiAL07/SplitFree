"use client";

import { createContext, useContext } from "react";
import { regionFor, type Region } from "@/lib/region";

const RegionContext = createContext<Region>(regionFor(null));

/** The visitor's region, decided on the server from their country, so client pieces (e.g. the phone field) can match it. */
export function RegionProvider({ region, children }: { region: Region; children: React.ReactNode }) {
  return <RegionContext.Provider value={region}>{children}</RegionContext.Provider>;
}

export const useRegion = () => useContext(RegionContext);
