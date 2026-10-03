import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallBanner, installKind, DISMISS_DAYS } from "@/components/layout/install-banner";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { ANDROID_APP } from "@/lib/android-app";

const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  androidFb: "Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};
const setUA = (ua: string, touch = 5) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true });
};
const standalone = (on: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("standalone"), media: q, addEventListener() {}, removeEventListener() {} }));
const visits = (n: number) => localStorage.setItem("splitfree-visits", String(n));

beforeEach(() => { standalone(false); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (navigator as { standalone?: boolean }).standalone; });

describe("installKind — when to nudge", () => {
  it("never on a first visit; from the second visit Android gets the app, iPhone Safari gets Add to Home Screen", () => {
    setUA(UA.android); expect(installKind()).toBe("");
    visits(2); expect(installKind()).toBe("android");
    setUA(UA.iosSafari); expect(installKind()).toBe("ios");
  });

  it("not for browsers that can't add to the home screen (Chrome on iOS, in-app browsers), nor on desktop", () => {
    visits(5);
    for (const ua of [UA.iosChrome, UA.instagram, UA.androidFb]) { setUA(ua); expect(installKind(), ua).toBe(""); }
    setUA(UA.desktop, 0); expect(installKind()).toBe("");
  });

  it("never inside the installed app (iOS home-screen app, PWA, or our Android app)", () => {
    visits(5); setUA(UA.iosSafari);
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    expect(installKind()).toBe("");
    delete (navigator as { standalone?: boolean }).standalone;
    standalone(true); expect(installKind()).toBe("");
    standalone(false); Object.defineProperty(document, "referrer", { value: "android-app://com.splitfree.app", configurable: true });
    setUA(UA.android); expect(installKind()).toBe("");
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
  });

  it(`stays away for ${DISMISS_DAYS} days after being dismissed, then may return`, () => {
    visits(3); setUA(UA.android);
    const now = Date.now();
    localStorage.setItem("splitfree-install-dismissed", String(now - 5 * 86_400_000));
    expect(installKind(now)).toBe("");
    localStorage.setItem("splitfree-install-dismissed", String(now - (DISMISS_DAYS + 1) * 86_400_000));
    expect(installKind(now)).toBe("android");
  });

  it("copes with blocked storage (private mode) without crashing", () => {
    setUA(UA.android);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(installKind()).toBe("");
  });
});

describe("InstallBanner", () => {
  it("counts a visit per session and appears on the second one", async () => {
    setUA(UA.android);
    const { unmount } = render(<InstallBanner />);
    expect(localStorage.getItem("splitfree-visits")).toBe("1");
    expect(screen.queryByTestId("install-banner")).not.toBeInTheDocument();
    unmount();
    sessionStorage.clear(); // a new session
    render(<InstallBanner />);
    await waitFor(() => expect(screen.getByTestId("install-banner")).toBeInTheDocument());
    expect(localStorage.getItem("splitfree-visits")).toBe("2");
  });

  it("doesn't recount within the same session", () => {
    setUA(UA.android);
    const a = render(<InstallBanner />); a.unmount();
    render(<InstallBanner />);
    expect(localStorage.getItem("splitfree-visits")).toBe("1");
  });

  it("Android: offers the real APK download", () => {
    visits(2); setUA(UA.android);
    render(<InstallBanner />);
    const banner = screen.getByTestId("install-banner");
    expect(banner).toHaveAttribute("data-kind", "android");
    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toHaveAttribute("href", ANDROID_APP.path);
    expect(link).toHaveAttribute("download", ANDROID_APP.fileName);
  });

  it("iPhone Safari: shows the Share → Add to Home Screen instruction (and no download link)", () => {
    visits(2); setUA(UA.iosSafari);
    render(<InstallBanner />);
    const banner = screen.getByTestId("install-banner");
    expect(banner).toHaveAttribute("data-kind", "ios");
    expect(banner).toHaveTextContent(/Add to Home Screen/);
    expect(screen.queryByRole("link", { name: "Download" })).not.toBeInTheDocument();
  });

  it("dismissing hides it right away and remembers for next time", async () => {
    visits(2); setUA(UA.android);
    render(<InstallBanner />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("install-banner")).not.toBeInTheDocument();
    expect(Number(localStorage.getItem("splitfree-install-dismissed"))).toBeGreaterThan(0);
  });

  it("is a labelled region and phone-only (hidden on large screens)", () => {
    visits(2); setUA(UA.android);
    render(<InstallBanner />);
    expect(screen.getByRole("region", { name: /install the app/i })).toHaveClass("lg:hidden");
  });
});

describe("InAppBrowserNotice (Google sign-in doesn't work inside Instagram/Facebook browsers)", () => {
  it("explains the problem and the way out on iPhone (Safari) and Android (Chrome), with a copy-link button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setUA(UA.instagram);
    const { unmount } = render(<InAppBrowserNotice />);
    expect(screen.getByTestId("inapp-notice")).toHaveTextContent(/Google sign-in doesn't work here/);
    expect(screen.getByTestId("inapp-notice")).toHaveTextContent(/Safari/);
    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    unmount();
    setUA(UA.androidFb);
    render(<InAppBrowserNotice />);
    expect(screen.getByTestId("inapp-notice")).toHaveTextContent(/Chrome/);
  });

  it("shows nothing in a real browser", () => {
    setUA(UA.iosSafari);
    const { container } = render(<InAppBrowserNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});
