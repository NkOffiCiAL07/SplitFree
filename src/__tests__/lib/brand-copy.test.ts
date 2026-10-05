import { describe, it, expect } from "vitest";
import { brandCopy, HEADLINE, OCCASIONS, SUBLINE } from "@/lib/brand-copy";
import { regionFor } from "@/lib/region";

describe("brandCopy", () => {
  it("India keeps the Hinglish voice exactly as before", () => {
    const c = brandCopy(regionFor("IN"));
    expect(`${c.line1} ${c.line2}`).toBe(HEADLINE);
    expect(c.subline).toBe(SUBLINE);
    expect(c.occasions).toBe(OCCASIONS);
    expect(c.feed).toEqual({ payer: "Asha", amount: "₹850", trip: "Goa trip" });
    expect(c.chips.join(" ")).toMatch(/UPI/);
  });

  it("everywhere else is clear English: no Hindi words, no UPI, no rupee sign, same shape", () => {
    for (const country of ["US", "GB", "AU", "DE", "AE", "SG", "ZZ"]) {
      const c = brandCopy(regionFor(country));
      const all = [c.line1, c.line2, c.subline, ...c.occasions, ...c.chips, c.feed.trip, c.feed.amount].join(" | ");
      expect(all, country).not.toMatch(/Hisaab|Dosti|bhai|paise|doge|shaadi|kharcha|chai-nashta|Goa|UPI|₹/);
      expect(c.line1.endsWith(".") && c.line2.endsWith("."), country).toBe(true); // same two-line, full-stop rhythm as the original
      expect(c.occasions.length).toBeGreaterThanOrEqual(5);
      expect(c.chips.length).toBe(brandCopy(regionFor("IN")).chips.length);
    }
  });

  it("uses the visitor's own currency in the examples", () => {
    expect(brandCopy(regionFor("GB")).chips[0]).toContain("£15");
    expect(brandCopy(regionFor("US")).feed.amount).toBe("$20");
  });
});
