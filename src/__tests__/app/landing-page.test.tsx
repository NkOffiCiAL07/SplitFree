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

  it("on iPhone: says iOS is coming soon and explains Add to Home Screen", () => {
    setUserAgent(iphone, 5);
    render(<DownloadPanel />);
    expect(screen.getByTestId("platform-hint")).toHaveTextContent(/Add to Home Screen/);
    expect(screen.getByTestId("platform-hint")).toHaveTextContent(/coming soon/i);
    expect(screen.queryByTestId("qr")).not.toBeInTheDocument();
  });

  it("recognises an iPad that pretends to be a Mac", () => {
    setUserAgent(ipadAsMac, 5);
    render(<DownloadPanel />);
    expect(screen.getByTestId("platform-hint")).toHaveTextContent(/Add to Home Screen/);
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
