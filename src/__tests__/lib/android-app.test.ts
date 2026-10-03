// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { ANDROID_APP, androidSizeLabel } from "@/lib/android-app";

const file = `public${ANDROID_APP.path}`;

describe("the published Android APK", () => {
  it("exists in /public so it is served as a static file", () => {
    expect(statSync(file).isFile()).toBe(true);
  });

  it("matches the size and SHA-256 shown on the landing page (so the checksum people verify is the real one)", () => {
    const bytes = readFileSync(file);
    expect(bytes.length).toBe(ANDROID_APP.sizeBytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(ANDROID_APP.sha256);
  });

  it("is a valid zip/APK container (not an HTML error page or a truncated file)", () => {
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK"); // zip local-file header
    const text = bytes.toString("latin1");
    expect(text).toContain("AndroidManifest.xml");
    expect(text).toContain("classes.dex");
    expect(text).toContain("META-INF/"); // signed
  });

  it("formats its size for people", () => {
    expect(androidSizeLabel).toBe("1.1 MB");
  });
});

describe("how it is served (vercel.json)", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const rule = config.headers.find((h) => h.source === ANDROID_APP.path);
  const header = (k: string) => rule?.headers.find((h) => h.key === k)?.value;

  it("has a rule for exactly the download path", () => {
    expect(rule).toBeDefined();
  });
  it("uses the Android package MIME type and forces a download with the right filename", () => {
    expect(header("Content-Type")).toBe("application/vnd.android.package-archive");
    expect(header("Content-Disposition")).toBe(`attachment; filename="${ANDROID_APP.fileName}"`);
  });
  it("doesn't let browsers sniff the type, and revalidates so a new build reaches people quickly", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Cache-Control")).toMatch(/must-revalidate/);
    expect(header("Cache-Control")).not.toMatch(/immutable/);
  });
});
