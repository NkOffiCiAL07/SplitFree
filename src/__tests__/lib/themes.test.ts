import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ACCENTS, DEFAULT_ACCENT, accentById, accentBootScript, accentCss, contrast, defaultVariables, hexToHsl } from "@/lib/themes";

describe("colour themes", () => {
  it("has twelve distinct themes, violet first and the default, and none of them red or green (those mean owe / owed)", () => {
    expect(ACCENTS.map((a) => a.id)).toEqual(["violet", "ocean", "teal", "sunset", "pink", "graphite", "sky", "indigo", "orchid", "amber", "coffee", "midnight"]);
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

  it("theme-coloured text stays readable on its own tinted background (the active menu pill and links): AA on the 10% tint and on the lightest step", () => {
    for (const a of ACCENTS) {
      expect(contrast(a.primaryLight, a.scale[100]), `${a.id} on tint`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.primaryLight, a.scale[50]), `${a.id} on lightest`).toBeGreaterThanOrEqual(4.5);
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

  describe("a theme recolours the whole page, not only the buttons", () => {
    const css = accentCss();
    const rule = (id: string, suffix = "") => css.split("}").find((r) => r.startsWith(`:root[data-accent="${id}"]${suffix}{`)) ?? "";

    it("every theme except the default tints the page background, cards' surroundings, borders and muted areas — in light and dark", () => {
      for (const a of ACCENTS.slice(1)) {
        const light = rule(a.id), dark = rule(a.id, ".dark");
        for (const v of ["--background", "--muted", "--secondary", "--accent", "--border", "--input", "--foreground", "--muted-foreground"]) expect(light, `${a.id} light ${v}`).toContain(`${v}:`);
        for (const v of ["--background", "--card", "--popover", "--muted", "--border", "--foreground", "--muted-foreground"]) expect(dark, `${a.id} dark ${v}`).toContain(`${v}:`);
      }
    });

    it("the default theme has no extra rules at all: it stays exactly as designed in globals.css", () => {
      expect(css).not.toContain('data-accent="violet"');
    });

    it("different themes really look different (their page backgrounds are not the same colour)", () => {
      const bg = (id: string) => rule(id).match(/--background:([^;]+);/)![1];
      expect(new Set(ACCENTS.slice(1).map((a) => bg(a.id))).size).toBe(ACCENTS.length - 1);
    });

    it("pure black still wins over a theme's dark tint", () => {
      for (const a of ACCENTS.slice(1)) expect(rule(a.id, ".dark[data-oled]"), a.id).toContain("--background:0 0% 0%");
    });

    it("text stays readable on every theme's page: foreground and muted text meet WCAG AA on its background", () => {
      const hsl = (v: string) => { const [h, s, l] = v.match(/[\d.]+/g)!.map(Number); const a = (s / 100) * Math.min(l / 100, 1 - l / 100); const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return "#" + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join(""); };
      const get = (r: string, v: string) => hsl(r.match(new RegExp(`${v}:([^;]+);`))![1]);
      for (const a of ACCENTS.slice(1)) {
        const light = rule(a.id), dark = rule(a.id, ".dark");
        expect(contrast(get(light, "--foreground"), get(light, "--background")), `${a.id} light text`).toBeGreaterThanOrEqual(7);
        expect(contrast(get(light, "--muted-foreground"), get(light, "--background")), `${a.id} light muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(get(light, "--muted-foreground"), get(light, "--muted")), `${a.id} light muted on muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(get(dark, "--foreground"), get(dark, "--background")), `${a.id} dark text (a theme must not leave light-mode text colour in dark mode)`).toBeGreaterThanOrEqual(12);
        expect(contrast(get(dark, "--muted-foreground"), get(dark, "--background")), `${a.id} dark muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(get(dark, "--muted-foreground"), get(dark, "--muted")), `${a.id} dark muted on muted`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
