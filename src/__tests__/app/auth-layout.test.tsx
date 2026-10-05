import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, within, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import AuthLayout, { metadata } from "@/app/(auth)/layout";
import { OCCASIONS, HEADLINE } from "@/lib/brand-copy";
import { viewport } from "@/app/(auth)/layout";

// The layout reads the visitor's country from the host's request header
const geo = vi.hoisted(() => ({ country: null as string | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(geo.country ? { "x-vercel-ip-country": geo.country } : {}) }));
const renderLayout = async (children: React.ReactNode, country: string | null = null) => {
  geo.country = country;
  return render(await AuthLayout({ children }));
};

describe("Auth layout — welcome for phones (and the Android app when signed out)", () => {
  it("shows what the app is above the form: name, tagline and the key benefits", async () => {
    await renderLayout(<form aria-label="login form" />);
    const welcome = screen.getByTestId("welcome");
    expect(welcome).toHaveTextContent("Splitr Pro");
    expect(welcome).toHaveTextContent("Hisaab saaf. Dosti barkaraar.");
    expect(welcome).toHaveTextContent(/bhai, paise kab doge/);
    expect(within(welcome).getByTestId("rotating-word")).toHaveTextContent(OCCASIONS[0]); // what it is for, one short line
  });

  it("is only for small screens (the desktop already has the branding panel) and is a labelled region", async () => {
    await renderLayout(<div />);
    expect(screen.getByTestId("welcome")).toHaveClass("lg:hidden");
    expect(screen.getByRole("region", { name: "Welcome" })).toBeInTheDocument();
  });

  it("puts the welcome ABOVE the form it wraps, and still renders the form", async () => {
    await renderLayout(<form aria-label="login form" />);
    const welcome = screen.getByTestId("welcome");
    const form = screen.getByRole("form", { name: "login form" });
    expect(welcome.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the 'Sign in' page title", async () => {
    expect(metadata.title).toBe("Sign in");
  });
});

describe("Auth layout — liquid glass", () => {
  it("puts the form on a frosted-glass card and keeps the decorative colour blobs out of the accessibility tree", async () => {
    const { container } = await renderLayout(<form aria-label="login form" />);
    const card = screen.getByRole("form", { name: "login form" }).parentElement!;
    expect(card).toHaveClass("lg-glass");
    const blobs = container.querySelectorAll(".lg-blob");
    expect(blobs.length).toBeGreaterThan(3);
    for (const b of blobs) expect(b.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("the desktop panel carries the new tagline, plain-words subline and trust points", async () => {
    const { container } = await renderLayout(<div />);
    const panel = container.querySelector("h2")!.parentElement!;
    expect(panel).toHaveTextContent("Hisaab saaf.");
    expect(panel).toHaveTextContent("Dosti barkaraar.");
    expect(panel).toHaveTextContent(/split trips, rent and dinners with friends, then settle up on UPI in one tap/i);
    for (const t of ["Free forever", "No ads", "Works offline"]) expect(within(panel).getByText(t)).toBeInTheDocument();
    expect(HEADLINE).toBe("Hisaab saaf. Dosti barkaraar.");
  });

  it("a live activity card shows the product in action (decoration, hidden from screen readers) and the highlight moves on", async () => {
    vi.useFakeTimers();
    try {
      await renderLayout(<div />);
      const feeds = screen.getAllByTestId("activity-feed");
      expect(feeds.length).toBeGreaterThan(0);
      for (const f of feeds) expect(f).toHaveAttribute("aria-hidden", "true");
      expect(feeds[0].textContent).toMatch(/Asha paid you ₹850/);
      const active = () => feeds[0].querySelector("[data-active='true']")?.textContent;
      const first = active();
      act(() => { vi.advanceTimersByTime(2700); });
      expect(active()).not.toBe(first);
    } finally { vi.useRealTimers(); }
  });

  it("hero and form share ONE aurora canvas, and the form card has the travelling edge light", async () => {
    const { container } = await renderLayout(<form aria-label="login form" />);
    expect(container.querySelectorAll(".auth-canvas")).toHaveLength(1);
    expect(container.querySelector(".auth-card-glow")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".auth-orb")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Rotating occasions", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("cycles through what the app is for, and screen readers get the list once", async () => {
    await renderLayout(<div />);
    const words = () => screen.getAllByTestId("rotating-word").map((w) => w.textContent);
    expect(words()).toEqual([OCCASIONS[0], OCCASIONS[0]]); // desktop + phone copies
    act(() => { vi.advanceTimersByTime(2700); });
    expect(words()[0]).toBe(OCCASIONS[1]);
    act(() => { vi.advanceTimersByTime(2600 * OCCASIONS.length); });
    expect(OCCASIONS).toContain(words()[0]);
    expect(screen.getAllByText(OCCASIONS.join(", "), { selector: ".sr-only" }).length).toBeGreaterThan(0);
  });
});

describe("Auth layout — phone chrome", () => {
  it("colours the phone's status bar like the header, so there's no white strip above the purple", async () => {
    expect(viewport.themeColor).toBe("#120b34");
    expect(viewport.viewportFit).toBe("cover");
  });

  it("the form sheet is a column that fills the screen (so the footer can sit at the bottom)", async () => {
    await renderLayout(<form aria-label="login form" />);
    const sheet = screen.getByRole("form", { name: "login form" }).parentElement!;
    expect(sheet).toHaveClass("flex", "flex-col", "flex-1");
  });
});

describe("Auth layout — phone sign-in animation", () => {
  it("has a scrolling strip of chips (twice, for a seamless loop), hidden from screen readers, and coins that never take clicks", async () => {
    await renderLayout(<form aria-label="login form" />);
    const strip = screen.getByTestId("chip-strip");
    expect(strip).toHaveAttribute("aria-hidden", "true");
    const chips = strip.querySelectorAll(".lg-glass-dark");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length % 2).toBe(0);
    expect(chips[0].textContent).toBe(chips[chips.length / 2].textContent);
    expect(strip.querySelector(".lg-marquee")).not.toBeNull();
    expect(document.querySelectorAll(".lg-coin").length).toBeGreaterThanOrEqual(5);
    for (const coin of document.querySelectorAll(".lg-coin")) expect(coin.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("the animations all stop for people who asked for reduced motion", async () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).map((b) => b.slice(0, b.indexOf("\n  }") + 4)).join("\n");
    for (const cls of [".lg-aurora", ".lg-text-shimmer", ".lg-marquee", ".lg-coin", ".auth-canvas", ".auth-card-glow", ".auth-orb"]) expect(reduced).toContain(cls);
  });

});

describe("Auth layout — steady desktop card", () => {
  it("the desktop form card has one fixed minimum height (tall enough for sign-up) so switching tabs never resizes it, and a small logo", async () => {
    const { container } = await renderLayout(<form aria-label="login form" />);
    const card = screen.getByRole("form", { name: "login form" }).parentElement!.parentElement!;
    expect(card.className).toContain("lg:min-h-[53rem]"); // always: the same size on both tabs, at every window height
    expect(card.className).not.toMatch(/\[@media[^\]]*\]:lg:min-h/); // (it used to apply only on tall screens, so short ones differed)
    expect(card.className).toContain("lg:my-auto"); // centred when there is room, scrolls from the top when there is not
    const heroLogo = container.querySelector(".anim-fade-up svg, .anim-fade-up img") as SVGElement | HTMLImageElement;
    expect(Number(heroLogo.getAttribute("width"))).toBeLessThanOrEqual(36);
  });
});


describe("Auth layout — words follow the visitor's country", () => {
  const hindi = /Hisaab saaf|Dosti barkaraar|bhai|paise kab doge|UPI|Goa|shaadi|chai-nashta|₹/;

  it("India (and no country at all, e.g. development) gets the Hinglish tagline", async () => {
    for (const c of ["IN", null]) {
      const { container, unmount } = await renderLayout(<div />, c);
      expect(screen.getByTestId("welcome")).toHaveTextContent("Hisaab saaf. Dosti barkaraar.");
      expect(container.textContent).toMatch(/bhai, paise kab doge/);
      expect(container.textContent).toMatch(/Asha paid you ₹850/);
      unmount();
    }
  });

  it.each([["US", "$20"], ["GB", "£15"], ["DE", "€18"], ["AE", "AED 75"]])("%s gets plain English with its own currency (%s) — no Hindi, no UPI, no rupees", async (country, amount) => {
    const { container } = await renderLayout(<div />, country);
    const text = container.textContent ?? "";
    expect(screen.getByTestId("welcome")).toHaveTextContent("Settle up. Stay friends.");
    expect(text).toMatch(/when are you paying me back/);
    expect(text).toContain(`Asha paid you ${amount}`);
    expect(text).toMatch(/Beach trip/);
    expect(text).not.toMatch(hindi);
    expect(screen.getAllByTestId("rotating-word")[0].textContent).not.toMatch(/Goa|shaadi|chai/);
  });
});

describe("phones get a lighter sign-in and cards (smooth scrolling on mid-range Android)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  it("no live background blur on glass cards on phones, with a more opaque fill instead", () => {
    expect(css).toMatch(/\.lg-glass, \.lg-glass-dark \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;/);
    expect(css).toMatch(/\.lg-glass \{ background: linear-gradient\(145deg, hsl\(0 0% 100% \/ 0\.92\)/);
  });

  it("the full-screen gradient animation and film grain are skipped on phones, but kept on desktop", () => {
    expect(css).toMatch(/@media \(max-width: 1023px\), \(pointer: coarse\) \{\s*\.auth-canvas \{ animation: none; \}\s*\.auth-grain \{ display: none; \}/);
    expect(css).toMatch(/\.auth-canvas \{[^}]*animation: auth-canvas 24s/); // desktop still animates
    expect(css).toMatch(/\.lg-glass \{[^}]*backdrop-filter: blur\(24px\)/); // desktop keeps the full glass effect
  });
});

