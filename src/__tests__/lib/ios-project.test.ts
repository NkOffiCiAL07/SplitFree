// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// These guard the things App Store review (or a first launch) trips over, without needing Xcode.
const read = (p: string) => readFileSync(p, "utf8");
const plistJson = (p: string): Record<string, unknown> => {
  try { return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", p], { encoding: "utf8" })); }
  catch { return {}; } // plutil is macOS-only
};
const hasPlutil = (() => { try { execFileSync("plutil", ["-help"], { stdio: "ignore" }); return true; } catch { return false; } })();

describe("capacitor.config.ts", () => {
  const cfg = read("capacitor.config.ts");
  it("uses the same app id as Android and the web manifest", () => {
    expect(cfg).toContain('appId: "com.splitfree.app"');
    expect(JSON.parse(read("public/manifest.json")).id).toBe("com.splitfree.app");
  });
  it("opens on the dashboard of the live site, keeps navigation to that host, has an offline fallback and a recognisable user agent", () => {
    expect(cfg).toContain('"/dashboard"');
    expect(cfg).toContain("https://splitfree-xi.vercel.app");
    expect(cfg).toContain('errorPath: "offline.html"');
    expect(cfg).toContain('appendUserAgent: "SplitrProApp/1.0"');
    expect(cfg).toContain("allowNavigation");
  });
  it("the keyboard shrinks the page body (no black gap behind the keyboard)", () => {
    expect(cfg).toContain('resize: "body"');
  });
  it("the launch image can never get stuck: it auto-hides after a timeout as a fallback", () => {
    expect(cfg).toMatch(/launchAutoHide: true/);
    expect(cfg).toMatch(/launchShowDuration: 8000/);
  });
  it("the offline page is bundled with the app", () => {
    expect(existsSync("ios-web/offline.html")).toBe(true);
    expect(read("ios-web/offline.html")).toMatch(/offline/i);
  });
});

describe("iOS project", () => {
  const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
  it("bundle id matches, iPhone only, iOS 15+, entitlements wired", () => {
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = com.splitfree.app;");
    expect(pbx).toContain("TARGETED_DEVICE_FAMILY = 1;");
    expect(pbx).not.toContain('TARGETED_DEVICE_FAMILY = "1,2"');
    expect(pbx).toContain("IPHONEOS_DEPLOYMENT_TARGET = 15.0;");
    expect(pbx).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
  });

  it.skipIf(!hasPlutil)("Info.plist: portrait only, 64-bit, export-compliance answered, UPI/WhatsApp schemes, deep-link scheme, local networking only", () => {
    const p = plistJson("ios/App/App/Info.plist");
    expect(p.CFBundleDisplayName).toBe("Splitr Pro");
    expect(p.UISupportedInterfaceOrientations).toEqual(["UIInterfaceOrientationPortrait"]);
    expect(p.UIRequiredDeviceCapabilities).toEqual(["arm64"]);
    expect(p.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(p.LSApplicationQueriesSchemes).toEqual(expect.arrayContaining(["gpay", "phonepe", "paytmmp", "upi", "whatsapp"]));
    expect(p.CFBundleURLTypes).toEqual([{ CFBundleURLName: "com.splitfree.app", CFBundleURLSchemes: ["splitrpro"] }]);
    expect(p.NSAppTransportSecurity).toEqual({ NSAllowsLocalNetworking: true }); // no blanket "allow arbitrary loads"
  });

  it("the UPI schemes the web app links to are all declared for the iPhone app", () => {
    const declared = read("ios/App/App/Info.plist");
    for (const scheme of ["gpay", "phonepe", "paytmmp", "upi"]) expect(declared).toContain(`<string>${scheme}</string>`);
  });

  it("universal links: the app claims the site, and the site's association file names the same app id", () => {
    expect(read("ios/App/App/App.entitlements")).toContain("applinks:splitfree-xi.vercel.app");
    const aasa = JSON.parse(read("public/.well-known/apple-app-site-association"));
    const ids: string[] = aasa.applinks.details.flatMap((d: { appIDs: string[] }) => d.appIDs);
    expect(ids.every((id) => id.endsWith(".com.splitfree.app"))).toBe(true);
    const paths = aasa.applinks.details.flatMap((d: { components: { "/": string }[] }) => d.components.map((c) => c["/"]));
    expect(paths).toContain("/join/*"); // WhatsApp invites are the whole point
  });

  it("the association file is served as JSON (vercel.json)", () => {
    const v = JSON.parse(read("vercel.json")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const rule = v.headers.find((h) => h.source === "/.well-known/apple-app-site-association")!;
    expect(rule.headers.find((h) => h.key === "Content-Type")?.value).toBe("application/json");
  });
});

describe("App Store artwork", () => {
  const png = (p: string) => readFileSync(p);
  it("app icon is 1024×1024 with NO transparency (Apple rejects alpha)", () => {
    const b = png("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1024, 1024]);
    expect(b[25]).toBe(2); // PNG colour type 2 = RGB (6 would be RGBA)
  });
  it("launch images exist at the size the asset catalog declares", () => {
    for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
      const b = png(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([2732, 2732]);
    }
  });
});
