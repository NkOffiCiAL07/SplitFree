import { describe, it, expect, afterEach, vi } from "vitest";
import { detectPlatform, isInAppBrowser, isIosSafari, isStandalone } from "@/lib/platform";

const UA = {
  pixelChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  instagramIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]",
  androidWebView: "Mozilla/5.0 (Linux; Android 12; Redmi Note 11 Build/SKQ1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36",
  iosWebView: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
};

describe("detectPlatform", () => {
  it("recognises Android, iPhone, iPadOS-as-Mac and desktop", () => {
    expect(detectPlatform(UA.pixelChrome)).toBe("android");
    expect(detectPlatform(UA.iphoneSafari)).toBe("ios");
    expect(detectPlatform(UA.iphoneChrome)).toBe("ios");
    expect(detectPlatform(UA.ipadAsMac, 5)).toBe("ios");
    expect(detectPlatform(UA.macSafari, 0)).toBe("desktop");
    expect(detectPlatform(UA.windows)).toBe("desktop");
    expect(detectPlatform("")).toBe("desktop");
  });
});

describe("isInAppBrowser", () => {
  it.each([["Instagram", UA.instagramIos], ["Facebook", UA.facebookAndroid], ["Android WebView", UA.androidWebView], ["iOS WebView", UA.iosWebView]])(
    "flags %s", (_n, ua) => expect(isInAppBrowser(ua)).toBe(true)
  );
  it.each([["Chrome on Android", UA.pixelChrome], ["Safari on iPhone", UA.iphoneSafari], ["Chrome on iPhone", UA.iphoneChrome], ["desktop Chrome", UA.windows]])(
    "does NOT flag %s", (_n, ua) => expect(isInAppBrowser(ua)).toBe(false)
  );
});

describe("isIosSafari", () => {
  it("only real Safari on iOS (other iOS browsers can't use Add to Home Screen the same way)", () => {
    expect(isIosSafari(UA.iphoneSafari)).toBe(true);
    expect(isIosSafari(UA.iphoneChrome)).toBe(false);
    expect(isIosSafari(UA.pixelChrome)).toBe(false);
    expect(isIosSafari(UA.instagramIos)).toBe(false);
  });
});

describe("isStandalone", () => {
  afterEach(() => { vi.unstubAllGlobals(); Object.defineProperty(document, "referrer", { value: "", configurable: true }); delete (navigator as { standalone?: boolean }).standalone; });
  const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches }));

  it("is false in a normal browser tab", () => { media(false); expect(isStandalone()).toBe(false); });
  it("true for an installed PWA (display-mode: standalone)", () => { media(true); expect(isStandalone()).toBe(true); });
  it("true for the iOS home-screen app (navigator.standalone)", () => { media(false); Object.defineProperty(navigator, "standalone", { value: true, configurable: true }); expect(isStandalone()).toBe(true); });
  it("true inside our Android app (TWA referrer)", () => { media(false); Object.defineProperty(document, "referrer", { value: "android-app://com.splitfree.app", configurable: true }); expect(isStandalone()).toBe(true); });
});
