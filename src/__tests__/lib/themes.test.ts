import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ACCENTS, DEFAULT_ACCENT, accentById, accentBootScript, accentCss, contrast, defaultVariables, hexToHsl } from "@/lib/themes";

describe("colour themes", () => {
  it("has six distinct palettes, violet first and the default, and none of them red or green (those mean owe / owed)", () => {
    expect(ACCENTS.map((a) => a.id)).toEqual(["violet", "ocean", "teal", "sunset", "pink", "graphite"]);
    expect(DEFAULT_ACCENT).toBe("violet");
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
  });

  it("every palette is a full 10-step scale of real colours, light to dark", () => {
    for (const a of ACCENTS) {
      expect(Object.keys(a.scale), a.id).toHaveLength(10);
      for (const hex of [...Object.values(a.scale), a.gradientTo, a.primaryLight, a.primaryDark]) expect(hex, a.id).toMatch(/^#[0-9a-f]{6}$/);
      const l = (h: string) => Number(hexToHsl(h).split(" ")[2].replace("%", ""));
      expect(l(a.scale[50]), a.id).toBeGreaterThan(l(a.scale[500]));
      expect(l(a.scale[500]), a.id).toBeGreaterThan(l(a.scale[900]));
    }
  });

  it("buttons stay readable: white text on the light-mode button colour and dark text on the dark-mode one (WCAG AA, 4.5:1)", () => {
    for (const a of ACCENTS) {
      expect(contrast(a.primaryLight, "#ffffff"), `${a.id} light`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.primaryDark, "#030712"), `${a.id} dark`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the default palette in globals.css is exactly the violet palette (so the two can never drift apart)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(defaultVariables().replace(/--primary:[^;]+;--ring:[^;]+;$/, ""));
    expect(css).toContain("--color-brand-600: hsl(var(--brand-600));");
  });

  it("generates CSS for every other palette (light and dark button colours), and none for the default", () => {
    const css = accentCss();
    for (const a of ACCENTS.slice(1)) {
      expect(css).toContain(`:root[data-accent="${a.id}"]{`);
      expect(css).toContain(`:root[data-accent="${a.id}"].dark{--primary:${hexToHsl(a.primaryDark)}`);
    }
    expect(css).not.toContain('data-accent="violet"');
  });

  it("an unknown or missing saved choice falls back to violet", () => {
    expect(accentById("nope").id).toBe("violet");
    expect(accentById(null).id).toBe("violet");
    expect(accentById("ocean").id).toBe("ocean");
  });

  it("the pre-paint script only ever sets safe values", () => {
    expect(accentBootScript).toContain('localStorage.getItem("splitr-accent")');
    expect(accentBootScript).toContain("/^[a-z]+$/.test(a)");
    expect(accentBootScript.trim().startsWith("try{")).toBe(true);
  });

  it("hexToHsl matches the values the app already used", () => {
    expect(hexToHsl("#7c3aed")).toBe("262 83% 58%");
    expect(hexToHsl("#ffffff")).toBe("0 0% 100%");
  });
});
