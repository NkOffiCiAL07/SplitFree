import { describe, it, expect, vi, beforeEach } from "vitest";

const cap = vi.hoisted(() => ({ native: false, platform: "web" as string, throwing: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => { if (cap.throwing) throw new Error("no bridge"); return cap.native; },
    getPlatform: () => { if (cap.throwing) throw new Error("no bridge"); return cap.platform; },
  },
}));
const haptics = vi.hoisted(() => ({ impact: vi.fn(), notification: vi.fn() }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: haptics,
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}));

import { deepLinkToPath, hasBrandHeader, isNativeApp, isNativeUserAgent, nativePlatform, NATIVE_UA_TOKEN } from "@/lib/native";
import { haptic } from "@/lib/haptics";
import { isInAppBrowser, isStandalone } from "@/lib/platform";

beforeEach(() => { cap.native = false; cap.platform = "web"; cap.throwing = false; vi.clearAllMocks(); });

describe("detecting the iPhone app", () => {
  it("native only when Capacitor says so; never throws if the bridge is missing", () => {
    expect(isNativeApp()).toBe(false);
    cap.native = true; cap.platform = "ios";
    expect(isNativeApp()).toBe(true);
    expect(nativePlatform()).toBe("ios");
    cap.throwing = true;
    expect(isNativeApp()).toBe(false);
    expect(nativePlatform()).toBe("web");
  });

  it("recognises the app from its user-agent token (matches capacitor.config.ts)", () => {
    expect(NATIVE_UA_TOKEN).toBe("SplitrProApp");
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone) Mobile/15E148 SplitrProApp/1.0")).toBe(true);
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone) Safari/604.1")).toBe(false);
  });

  it("our own app's web view is not treated as 'someone else's in-app browser' (it has no Safari token), and counts as installed", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SplitrProApp/1.0";
    expect(isInAppBrowser(ua)).toBe(false);
    // …whereas the same web view without our token IS flagged (Google sign-in wouldn't work there)
    expect(isInAppBrowser(ua.replace(" SplitrProApp/1.0", ""))).toBe(true);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
    expect(isStandalone()).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("status bar by screen", () => {
  it.each([["/login", true], ["/signup", true], ["/reset-password", true], ["/reset-password/update", true], ["/dashboard", false], ["/groups/abc", false], ["/loginx", false], ["/", false]])(
    "%s → brand header: %s", (path, expected) => expect(hasBrandHeader(path)).toBe(expected)
  );
});

describe("deepLinkToPath (opening links inside the app)", () => {
  const host = "splitfree-xi.vercel.app";
  it("universal links keep their path, query and hash", () => {
    expect(deepLinkToPath("https://splitfree-xi.vercel.app/join/abc123", host)).toBe("/join/abc123");
    expect(deepLinkToPath("https://splitfree-xi.vercel.app/friends/u1?from=wa#top", host)).toBe("/friends/u1?from=wa#top");
  });
  it("the custom scheme splitrpro://join/abc maps to /join/abc", () => {
    expect(deepLinkToPath("splitrpro://join/abc123", host)).toBe("/join/abc123");
    expect(deepLinkToPath("splitrpro://dashboard", host)).toBe("/dashboard");
    expect(deepLinkToPath("splitrpro://settle?x=1", host)).toBe("/settle?x=1");
  });
  it("never navigates to another site, or to nonsense", () => {
    expect(deepLinkToPath("https://evil.example.com/join/abc", host)).toBeNull();
    expect(deepLinkToPath("https://splitfree-xi.vercel.app.evil.com/join/abc", host)).toBeNull();
    expect(deepLinkToPath("javascript:alert(1)", host)).toBeNull();
    expect(deepLinkToPath("not a url", host)).toBeNull();
    expect(deepLinkToPath("", host)).toBeNull();
  });
});

describe("haptic()", () => {
  it("uses real haptics in the iPhone app: a tap for light, a notification pattern for success/warning/error", async () => {
    cap.native = true;
    await haptic("light");
    expect(haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
    await haptic("success"); await haptic("warning"); await haptic("error");
    expect(haptics.notification.mock.calls.map((c) => c[0].type)).toEqual(["SUCCESS", "WARNING", "ERROR"]);
  });

  it("vibrates briefly on browsers that can; does nothing (and doesn't throw) elsewhere", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    await haptic("success");
    expect(vibrate).toHaveBeenCalledWith([12, 40, 12]);
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true });
    await expect(haptic("error")).resolves.toBeUndefined();
    expect(haptics.notification).not.toHaveBeenCalled();
  });

  it("a failing haptic engine never breaks the action it decorates", async () => {
    cap.native = true;
    haptics.impact.mockRejectedValueOnce(new Error("no taptic engine"));
    await expect(haptic("light")).resolves.toBeUndefined();
  });
});
