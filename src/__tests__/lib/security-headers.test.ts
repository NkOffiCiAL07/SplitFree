import { describe, it, expect } from "vitest";
import nextConfig from "../../../next.config";

describe("security headers", () => {
  it("every route gets the hardening headers, and the service worker is still never cached", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key, x.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    const sw = rules.find((r) => r.source === "/sw.js")!;
    expect(sw.headers.find((x) => x.key === "Cache-Control")!.value).toContain("no-store");
  });
});
