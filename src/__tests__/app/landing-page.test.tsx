import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/layout/theme-toggle", () => ({ ThemeToggle: () => <div /> }));
vi.mock("next/dynamic", () => ({ default: () => (p: { value: string }) => <svg data-testid="qr" data-value={p.value} /> }));

import LandingPage from "@/app/page";
import { DownloadPanel } from "@/components/landing/download-panel";
import { ANDROID_APP } from "@/lib/android-app";

const setUserAgent = (ua: string, touchPoints = 0) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  Object.defineProperty(navigator, "maxTouchPoints", { value: touchPoints, configurable: true }); // not defined by jsdom
};
afterEach(() => vi.restoreAllMocks());

describe("Landing page — Android app", () => {
  it("offers a direct APK download (a plain link, so it works without JavaScript)", () => {
    render(<LandingPage />);
    const links = screen.getAllByTestId("android-download");
    expect(links.length).toBeGreaterThanOrEqual(2); // hero and the final call to action
    for (const a of links) {
      expect(a).toHaveAttribute("href", ANDROID_APP.path);
      expect(a).toHaveAttribute("download", ANDROID_APP.fileName);
      expect(a).toHaveTextContent(/download for\s*android/i);
    }
  });

  it("says iOS is coming soon — and it isn't a link or button that goes anywhere", () => {
    render(<LandingPage />);
    const badges = screen.getAllByTestId("ios-coming-soon");
    expect(badges.length).toBeGreaterThanOrEqual(1);
    for (const b of badges) {
      expect(b).toHaveTextContent(/coming soon/i);
      expect(b.closest("a")).toBeNull();
      expect(within(b).queryByRole("link")).toBeNull();
      expect(within(b).queryByRole("button")).toBeNull();
    }
    expect(screen.getByText(/Android app is here — iOS coming soon/)).toBeInTheDocument();
  });

  it("explains installing, shows the checksum and gives iPhone users a working option today", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Install unknown apps/i, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByTestId("apk-sha256")).toHaveTextContent(ANDROID_APP.sha256);
    expect(screen.getAllByText(/Add to Home Screen/i).length).toBeGreaterThan(0);
  });

  it("has the main sections and working navigation anchors", () => {
    const { container } = render(<LandingPage />);
    for (const id of ["download", "features", "faq"]) expect(container.querySelector(`#${id}`)).not.toBeNull();
    expect(screen.getAllByRole("link", { name: "Android app" }).every((a) => a.getAttribute("href") === "#download")).toBe(true);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  });

  it("has a quiet way in — Sign in in the header (and footer) — and no demo, sign-up or 'get started' buttons", () => {
    render(<LandingPage />);
    const signIn = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(signIn).toHaveLength(2); // header + footer only: no sign-in buttons in the hero or closing section
    for (const a of signIn) expect(a).toHaveAttribute("href", "/login");
    expect(screen.getByRole("banner")).toContainElement(signIn[0]);
    expect(screen.queryByRole("link", { name: /get started|start splitting|sign up|try demo|demo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /demo|get started|start splitting/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("answers the questions people have in an accessible accordion", async () => {
    render(<LandingPage />);
    const q = screen.getByText("What about iPhone?");
    expect(q.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(q);
    expect(q.closest("details")).toHaveAttribute("open");
    expect(q.closest("details")).toHaveTextContent(/coming soon/i);
  });

  it("makes no invented claims (no fake user counts or made-up testimonials)", () => {
    render(<LandingPage />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/5,000\+|500\+ groups|Loved by users|Real people, real savings/);
    expect(text).not.toMatch(/15\+ currencies/);
    expect(text).toMatch(/7 currencies/);
  });

  it("shows money with colour and words, never +/− signs", () => {
    render(<LandingPage />);
    expect(document.body.textContent).not.toMatch(/[+−]\s?₹/);
  });
});

describe("Landing page — voice and liquid-glass design", () => {
  it("leads with the plain, relatable tagline and explains it in one sentence", () => {
    render(<LandingPage />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Hisaab saaf.");
    expect(h1).toHaveTextContent("Dosti barkaraar.");
    expect(document.body.textContent).toMatch(/bhai, paise kab doge/);
    expect(document.body.textContent).toMatch(/settle up on UPI in one tap/);
  });

  it("rotates what the app is for (and the full list is available to screen readers)", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("rotating-word")).toHaveTextContent("Goa trips");
    expect(screen.getByText(/Goa trips, flat rent, office lunches/, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("feature cards and FAQ items are frosted glass, and the highlights strip is a moving marquee with a hidden duplicate", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll("#features .lg-glass").length).toBeGreaterThanOrEqual(12);
    expect(container.querySelectorAll("#faq details.lg-glass").length).toBeGreaterThanOrEqual(5);
    const marquee = container.querySelector(".lg-marquee")!;
    expect(marquee).not.toBeNull();
    expect(marquee.querySelectorAll("ul[aria-hidden='true']")).toHaveLength(1); // the looped copy isn't read twice
  });

  it("decorative colour blobs are hidden from assistive tech", () => {
    const { container } = render(<LandingPage />);
    const blobs = container.querySelectorAll(".lg-blob");
    expect(blobs.length).toBeGreaterThan(8);
    for (const b of blobs) expect(b.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("content is fully visible without JavaScript: nothing is hidden by default (reveal arms only in the browser)", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll(".reveal-armed")).toHaveLength(0);
  });
});

describe("DownloadPanel — tailored to the visitor", () => {
  const desktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
  const ipadAsMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

  beforeEach(() => setUserAgent(desktop));

  it("on a computer: shows a QR code that points at the APK on this site", () => {
    render(<DownloadPanel />);
    const qr = screen.getByTestId("qr");
    expect(qr).toHaveAttribute("data-value", `${window.location.origin}${ANDROID_APP.path}`);
    expect(screen.getByTestId("platform-hint")).toHaveTextContent(/scan the code with your android phone/i);
  });

  it("on Android: tells them to just tap Download, and doesn't show a QR code", () => {
    setUserAgent(android);
    render(<DownloadPanel />);
    expect(screen.getByTestId("platform-hint")).toHaveTextContent(/you're on android/i);
    expect(screen.queryByTestId("qr")).not.toBeInTheDocument();
  });

  it("on iPhone: opens on the iPhone tab with the Add to Home Screen steps and says a native app is coming soon", () => {
    setUserAgent(iphone, 5);
    render(<DownloadPanel />);
    expect(screen.getByRole("tab", { name: "iPhone" })).toHaveAttribute("aria-selected", "true");
    const steps = screen.getByTestId("ios-steps");
    expect(steps).toHaveTextContent(/Safari/);
    expect(steps).toHaveTextContent(/Share/);
    expect(steps).toHaveTextContent(/Add to Home Screen/);
    expect(screen.getByTestId("ios-coming-soon")).toHaveTextContent(/coming soon/i);
    expect(screen.queryByTestId("qr")).not.toBeInTheDocument();
    expect(screen.queryByTestId("android-download")).not.toBeInTheDocument(); // an iPhone can't install the APK
  });

  it("recognises an iPad that pretends to be a Mac", () => {
    setUserAgent(ipadAsMac, 5);
    render(<DownloadPanel />);
    expect(screen.getByRole("tab", { name: "iPhone" })).toHaveAttribute("aria-selected", "true");
  });

  it("Android and desktop open on the Android tab, and anyone can switch tabs", async () => {
    setUserAgent(android);
    render(<DownloadPanel />);
    expect(screen.getByRole("tab", { name: "Android" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("android-download")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "iPhone" }));
    expect(screen.getByRole("tab", { name: "iPhone" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("ios-steps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Android" }));
    expect(screen.getByTestId("android-download")).toBeInTheDocument();
  });

  it("each tab is a labelled panel (screen readers hear which phone the steps are for)", () => {
    setUserAgent(android);
    render(<DownloadPanel />);
    expect(screen.getByRole("tablist", { name: /choose your phone/i })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-android");
  });

  it("on a computer the iPhone tab shows a QR code to the site itself (not the APK)", async () => {
    render(<DownloadPanel />);
    await userEvent.click(screen.getByRole("tab", { name: "iPhone" }));
    expect(screen.getByTestId("qr")).toHaveAttribute("data-value", window.location.origin);
  });

  it("inside another app's browser (Instagram etc.) the iPhone tab says to open Safari, and offers the link to copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0", 5);
    render(<DownloadPanel />);
    expect(screen.getByTestId("ios-inapp-warning")).toHaveTextContent(/open it in Safari/i);
    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin);
  });

  it("no in-app warning in real Safari", () => {
    setUserAgent(iphone, 5);
    render(<DownloadPanel />);
    expect(screen.queryByTestId("ios-inapp-warning")).not.toBeInTheDocument();
  });

  it("copies the checksum", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DownloadPanel />);
    await userEvent.click(screen.getByRole("button", { name: /copy sha-256/i }));
    expect(writeText).toHaveBeenCalledWith(ANDROID_APP.sha256);
  });

  it("survives a blocked clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<DownloadPanel />);
    await userEvent.click(screen.getByRole("button", { name: /copy sha-256/i }));
    expect(screen.getByTestId("apk-sha256")).toBeInTheDocument();
  });
});
