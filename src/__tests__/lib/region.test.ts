import { describe, it, expect } from "vitest";
import { regionFor } from "@/lib/region";

describe("regionFor", () => {
  it("India — and no header at all (development, tests) — gets the India defaults", () => {
    for (const c of ["IN", "in", " IN ", "", null, undefined]) {
      const r = regionFor(c);
      expect(r.isIndia).toBe(true);
      expect(r.amount).toBe("₹850");
      expect(r.dial).toBe("91");
    }
  });

  it("anywhere else is NOT India, with that country's currency symbol and dial code", () => {
    expect(regionFor("US")).toMatchObject({ isIndia: false, amount: "$20", dial: "1" });
    expect(regionFor("GB")).toMatchObject({ isIndia: false, amount: "£15", dial: "44", phoneExample: "07911 123456" });
    expect(regionFor("DE")).toMatchObject({ isIndia: false, amount: "€18", dial: "49" });
    expect(regionFor("AE").amount).toBe("AED 75");
    expect(regionFor("JP").amount).toBe("¥2,000");
  });

  it("an unknown country is still international (English, $), with no guessed dial code", () => {
    const r = regionFor("ZZ");
    expect(r.isIndia).toBe(false);
    expect(r.amount).toBe("$20");
    expect(r.dial).toBeUndefined();
    expect(r.phoneExample).toMatch(/^\+/); // must be typed with a + code
  });
});
