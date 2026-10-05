import { describe, it, expect } from "vitest";
import { COUNTRIES, countryByCode, dialFor, flagOf, parseE164 } from "@/lib/countries";

describe("countries", () => {
  it("India first, every code unique, sensible dial codes", () => {
    expect(COUNTRIES[0].code).toBe("IN");
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.dial).toMatch(/^[1-9]\d{0,2}$/);
      expect(c.example, c.code).toBeTruthy();
    }
  });
  it("looks countries up by code, any case", () => {
    expect(dialFor("in")).toBe("91");
    expect(dialFor("US")).toBe("1");
    expect(dialFor("ZZ")).toBeUndefined();
    expect(countryByCode(null)).toBeUndefined();
  });
  it("makes flag emoji from the code", () => {
    expect(flagOf("IN")).toBe("🇮🇳");
    expect(flagOf("gb")).toBe("🇬🇧");
  });
  it("splits a stored number back into country + national number", () => {
    expect(parseE164("+919876543210")).toEqual({ country: "IN", national: "9876543210" });
    expect(parseE164("+447911123456")).toEqual({ country: "GB", national: "7911123456" });
    expect(parseE164("+971501234567")).toEqual({ country: "AE", national: "501234567" });
    expect(parseE164("+14155552671")).toEqual({ country: "US", national: "4155552671" }); // shared +1 → first listed
    expect(parseE164("9876543210")).toBeNull();
    expect(parseE164("")).toBeNull();
    expect(parseE164(null)).toBeNull();
  });
});
