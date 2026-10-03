// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "" }), Geist_Mono: () => ({ variable: "" }) }));
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { IPHONE_SPLASH_SIZES, iosStartupImages, splashUrl, SPLASH_MAX, SPLASH_MIN } from "@/lib/ios-splash";
import { GET as SPLASH } from "@/app/api/splash/route";
import { viewport, metadata } from "@/app/layout";

const get = (qs: string) => SPLASH(new NextRequest(`http://x/api/splash${qs}`));

describe("iOS launch images", () => {
  it("covers the current iPhone sizes, each with a media query that matches exactly that screen", () => {
    const imgs = iosStartupImages();
    expect(imgs).toHaveLength(IPHONE_SPLASH_SIZES.length);
    const first = imgs[0];
    expect(first.url).toBe(splashUrl(440 * 3, 956 * 3));
    expect(first.media).toBe("(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)");
    for (const i of imgs) {
      const [w, h] = i.url.match(/w=(\d+)&h=(\d+)/)!.slice(1).map(Number);
      expect(w).toBeGreaterThanOrEqual(SPLASH_MIN); expect(h).toBeLessThanOrEqual(SPLASH_MAX);
    }
    expect(new Set(imgs.map((i) => i.media)).size).toBe(imgs.length); // no two screens share a rule
  });

  it("is wired into the app metadata (home-screen app, launch images, no phone-number auto-linking)", () => {
    expect(metadata.appleWebApp).toMatchObject({ capable: true, title: "Splitr Pro" });
    expect((metadata.appleWebApp as { startupImage: unknown[] }).startupImage).toHaveLength(IPHONE_SPLASH_SIZES.length);
    expect(metadata.formatDetection).toMatchObject({ telephone: false });
    expect((metadata.other as Record<string, string>)["apple-mobile-web-app-capable"]).toBe("yes"); // older iOS needs the prefixed tag
  });

  it("serves a PNG of the requested size, cached for a year", async () => {
    const res = await get("?w=1170&h=2532");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/max-age=31536000/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
    const dv = new DataView(bytes.buffer);
    expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([1170, 2532]); // IHDR width/height
  });

  it.each(["", "?w=abc&h=100", "?w=100&h=100", "?w=5000&h=2000", "?w=1170.5&h=2532", "?w=1170"])("rejects bad sizes (%s) instead of rendering", async (qs) => {
    expect((await get(qs)).status).toBe(400);
  });
});

describe("viewport", () => {
  it("draws under the notch (viewport-fit=cover) and does NOT block pinch-zoom (accessibility)", () => {
    expect(viewport.viewportFit).toBe("cover");
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).toBeUndefined();
  });
});

describe("touch-device CSS (globals.css)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  it("makes form fields at least 16px on touch devices so iOS doesn't zoom on focus", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*?font-size: max\(16px, 1em\)/);
  });
  it("removes the tap delay and the grey tap flash", () => {
    expect(css).toMatch(/-webkit-tap-highlight-color: transparent/);
    expect(css).toMatch(/touch-action: manipulation/);
  });
  it("lightens the liquid-glass animation on phones", () => {
    expect(css).toMatch(/@media \(max-width: 1023px\), \(pointer: coarse\)\s*\{[\s\S]*?\.lg-blob \{ filter: blur\(34px\); animation: lg-drift/);
  });
});
