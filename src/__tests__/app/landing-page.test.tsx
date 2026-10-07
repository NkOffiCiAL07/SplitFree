import { readFileSync } from "node:fs";
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
    expect(links.length).toBeGreaterThanOrEqual(1); // the download section (the hero and closing statement stay about the product)
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

  it("explains installing and gives iPhone users a working option today — without technical noise (no checksum, package name or 'signed release' box)", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Install unknown apps/i)).toBeInTheDocument(); // the install guide lives in the questions, not as a marketing section
    expect(document.querySelector("#download")!.textContent).not.toMatch(/Install unknown apps/i);
    expect(screen.queryByTestId("apk-sha256")).toBeNull();
    expect(document.body.textContent).not.toMatch(/SHA-256|checksum|package com\.|Signed release|file is genuine/i);
    expect(screen.getAllByText(/Add to Home Screen/i).length).toBeGreaterThan(0);
  });

  it("has the main sections and working navigation anchors", () => {
    const { container } = render(<LandingPage />);
    for (const id of ["download", "features", "faq"]) expect(container.querySelector(`#${id}`)).not.toBeNull();
    expect(screen.getAllByRole("link", { name: "Android app" }).every((a) => a.getAttribute("href") === "#download")).toBe(true);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  });

  it("has a clear way in: Sign in (header and footer), Get started in the header, and 'Start splitting' in the hero and the closing section", () => {
    render(<LandingPage />);
    const signIn = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(signIn).toHaveLength(2); // header + footer
    for (const a of signIn) expect(a).toHaveAttribute("href", "/login");
    expect(screen.getByRole("banner")).toContainElement(signIn[0]);
    expect(within(screen.getByRole("banner")).getByRole("link", { name: /^get started$/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByTestId("hero-primary")).toHaveAttribute("href", "/signup");
    expect(screen.getByTestId("hero-primary")).toHaveTextContent("Start splitting");
    expect(screen.getByTestId("hero-secondary")).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByTestId("final-cta")).toHaveAttribute("href", "/signup");
    expect(document.querySelector("#how-it-works")).not.toBeNull(); // the secondary button has somewhere to go
    expect(screen.queryByRole("link", { name: /try demo/i })).not.toBeInTheDocument();
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

  it("the four feature groups and the FAQ items are cards; the repeated highlights marquee is gone", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll("#features article")).toHaveLength(4); // four big ideas, the smaller features inside them
    expect(container.querySelectorAll("#faq details.lg-glass").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelector(".lg-marquee")).toBeNull(); // the features are said once, in the four groups
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

  it("survives a blocked clipboard when copying the page link", async () => {
    setUserAgent(iphone, 5);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<DownloadPanel />);
    // (nothing to copy outside an in-app browser; the panel must simply keep working)
    expect(screen.getAllByText(/Add to Home Screen/i).length).toBeGreaterThan(0);
  });
});

describe("Landing page — English version for visitors outside India", () => {
  it("India's page keeps the Hinglish tagline", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hisaab saaf. Dosti barkaraar.");
    expect(document.body.textContent).toMatch(/bhai, paise kab doge/);
  });

  it("the international page says the same thing in English", async () => {
    const { default: IntlPage, metadata } = await import("@/app/intl/page");
    render(<IntlPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settle up. Stay friends.");
    expect(document.body.textContent).toMatch(/when are you paying me back/);
    expect(document.body.textContent).not.toMatch(/Hisaab|Dosti|bhai, paise|shaadi/);
    // search engines index "/" only
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/");
  });
});

describe("Landing page — the English version has no India-only wording", () => {
  const indiaOnly = /₹|UPI|GPay|PhonePe|Paytm|paisa|rupee|Hisaab|Dosti|bhai|shaadi|chai|Goa|Pune|Ola |Barbeque|in India/i;

  it("says nothing about rupees, UPI or India anywhere — page text, examples, features, steps and the highlights strip", async () => {
    const { default: IntlPage } = await import("@/app/intl/page");
    const { container } = render(<IntlPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(indiaOnly);
    expect(text).toMatch(/never a cent lost or invented/);
    expect(text).toMatch(/\$20 · Settled/);
    expect(text).toMatch(/Invite & remind on WhatsApp/);
    expect(text).toMatch(/Pay however you like/);
  });

  it("India's page keeps UPI, rupees and the paisa wording", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/UPI in one tap/);
    expect(text).toMatch(/never a cent lost or invented/); // (the splitter's line; the separate "Careful with money" section was removed)
    expect(text).toMatch(/₹1,190/);
    expect(text).toMatch(/built around how people in India/i);
  });

  it("both versions keep the same sections, counts and calls to action", async () => {
    const { default: IntlPage } = await import("@/app/intl/page");
    const a = render(<LandingPage />);
    const inIds = Array.from(a.container.querySelectorAll("section[id]")).map((s) => s.id);
    const inCards = a.container.querySelectorAll("#features .lg-glass").length;
    a.unmount();
    const b = render(<IntlPage />);
    expect(Array.from(b.container.querySelectorAll("section[id]")).map((s) => s.id)).toEqual(inIds);
    expect(b.container.querySelectorAll("#features .lg-glass").length).toBe(inCards);
  });
});

describe("Landing page — joining by QR code", () => {
  it("the QR join feature is named once among the features and in step 1, without a section of its own", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector("#scan-to-join")).toBeNull();
    expect(container.querySelector("#features")!.textContent).toMatch(/Join by QR/);
    expect(document.body.textContent).toMatch(/Share an invite link or show a QR code/);
  });
});

describe("Landing page — the new hero and callouts", () => {
  it("has the live splitter, the tabbed phone demo, the Splitwise callout and the animated settle-up scene", () => {
    const { container } = render(<LandingPage />);
    expect(screen.getByTestId("split-tryout")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: /see the app in action/i })).toBeInTheDocument();
    expect(container.querySelector("#from-splitwise")).not.toBeNull();
    expect(screen.getByRole("heading", { name: /ten payments\. three transfers\. done/i })).toBeInTheDocument();
  });

  it("the iPhone block in the hero collects an email (it used to be a dead 'coming soon' box)", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("ios-notify")).toBeInTheDocument();
    expect(screen.getByLabelText("Your email")).toBeInTheDocument();
  });

  it("'Start splitting' is the primary action: the download buttons are quieter (no glow)", () => {
    render(<LandingPage />);
    expect(screen.getAllByTestId("android-download")[0]).not.toHaveClass("cta-glow");
    expect(screen.getByTestId("hero-primary").className).toContain("bg-[#5b57e8]");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain('[data-testid="hero-primary"] { color: #fff; }'); // white label on the indigo button in light mode
  });

  it("answers 'why a direct download?' honestly, with no claim it can't back up", () => {
    render(<LandingPage />);
    expect(screen.getByText("Why is Android a direct download?")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/verified (&|and) safe|clean security record|virus[- ]free/i);
  });

  it("the English page has all the same pieces (and still no India-only wording)", async () => {
    const { default: IntlPage } = await import("@/app/intl/page");
    const { container } = render(<IntlPage />);
    expect(container.querySelector("#from-splitwise")).not.toBeNull();
    expect(screen.getByTestId("split-tryout")).toHaveTextContent("$");
    expect(container.textContent).not.toMatch(/₹|UPI/);
  });
});

describe("Landing page — no 'Careful with money' section", () => {
  it("is gone: the exactness claim lives in the splitter demo, not a separate text block", () => {
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/Careful with money|numbers have to be right/);
  });
});
