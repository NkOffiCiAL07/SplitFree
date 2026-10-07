import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import AuthLayout, { metadata, viewport } from "@/app/(auth)/layout";

// The layout reads the visitor's country from the host's request header
const geo = vi.hoisted(() => ({ country: null as string | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(geo.country ? { "x-vercel-ip-country": geo.country } : {}) }));
const renderLayout = async (children: React.ReactNode, country: string | null = null) => {
  geo.country = country;
  return render(await AuthLayout({ children }));
};

describe("Auth layout — calm and trustworthy", () => {
  it("is an almost-white page (dark in dark mode) with one soft glow, and none of the old aurora, glass, coins or pot", async () => {
    const { container } = await renderLayout(<form aria-label="login form" />);
    const page = container.firstElementChild!;
    expect(page).toHaveClass("auth-calm", "bg-[#f5f7fc]"); // light is the primary look
    expect(page.className).toContain("dark:bg-[#08090d]"); // and dark is designed separately
    expect(screen.getByTestId("calm-glow")).toHaveAttribute("aria-hidden", "true");
    for (const old of [".auth-canvas", ".lg-blob", ".lg-coin", ".lg-glass", ".auth-grain", ".auth-orb", ".auth-card-glow", "[data-testid=activity-feed]", "[data-testid=chip-strip]"]) {
      expect(container.querySelector(old), old).toBeNull();
    }
  });

  it("has a small logo and a way back to the home page (hidden inside the app, which has no home page)", async () => {
    await renderLayout(<div />);
    const home = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/");
    expect(home).toHaveLength(2); // logo + "Back to home"
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back).toHaveAttribute("data-hide-in-app");
    const logo = document.querySelector("header svg") as SVGElement;
    expect(Number(logo.getAttribute("width"))).toBeLessThanOrEqual(30);
  });

  it("renders the form inside one plain card: the same fixed minimum height for sign-in and sign-up on desktop, and no card on phones", async () => {
    await renderLayout(<form aria-label="login form" />);
    const card = screen.getByTestId("auth-card");
    expect(card).toContainElement(screen.getByRole("form", { name: "login form" }));
    expect(card.className).toContain("lg:min-h-[56rem]"); // always: the same size on both tabs
    expect(card.className).toContain("lg:border");
    expect(card.className).toContain("lg:bg-white/[0.72]"); // light glass, readable
    expect(card.className).toContain("dark:lg:bg-white/[0.055]");
    expect(card.className).toContain("lg:backdrop-blur-[28px]");
    expect(screen.getByTestId("calm-light")).toHaveClass("hidden", "lg:block"); // the light behind the glass exists on desktop only
    expect(card.className).not.toMatch(/(^|\s)(border|bg-white|shadow)/); // (those only apply from the desktop breakpoint up)
    expect(card).toHaveClass("flex-1"); // on a phone the form fills the screen so the footer sits at the bottom
  });

  it("keeps the 'Sign in' title, and colours the phone's status bar like the page in light and dark", () => {
    expect(metadata.title).toBe("Sign in");
    expect(viewport.themeColor).toEqual([{ media: "(prefers-color-scheme: light)", color: "#f5f7fc" }, { media: "(prefers-color-scheme: dark)", color: "#08090d" }]);
    expect(viewport.viewportFit).toBe("cover");
  });

  it("works for every country (the country only sets the phone-number default now; there is no marketing copy to localise)", async () => {
    for (const c of ["IN", "US", null]) {
      const { unmount } = await renderLayout(<form aria-label="login form" />, c);
      expect(screen.getByRole("form", { name: "login form" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("Auth layout — calm styles", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  it("one solid indigo button (#5B5CE2, darker on hover) without the sweeping light or pulsing glow", () => {
    expect(css).toMatch(/\.auth-calm \.btn-liquid \{[^}]*background: #635bff !important/);
    expect(css).toMatch(/\.auth-calm \.btn-liquid:hover:not\(:disabled\) \{[^}]*#746eff/);
    expect(css).toMatch(/\.auth-calm \.lg-ready \{ animation: none; \}/);
    expect(css).toMatch(/\.auth-calm \.btn-liquid::before, \.auth-calm \.lg-shine::after \{ display: none; \}/);
  });
  it("keyboard users see a clear ring on the main button (light and dark)", () => {
    expect(css).toMatch(/\.auth-calm \.btn-liquid:focus-visible \{ outline: 2px solid #5b57e8; outline-offset: 3px; \}/);
    expect(css).toMatch(/\.dark \.auth-calm \.btn-liquid:focus-visible \{ outline-color: #a5a0ff; \}/);
  });
  it("fields get a 1px indigo border and a soft ring on focus; invalid ones turn red quietly", () => {
    expect(css).toMatch(/\.auth-calm input:focus-visible[^{]*\{[^}]*border-color: #635bff;[^}]*rgba\(99, 91, 255, 0\.10\)/);
    expect(css).toMatch(/\.auth-calm \[aria-invalid="true"\] \{ border-color: #dc2626; \}/);
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


describe("dark mode follows the app's theme, not the device's setting", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  it("`dark:` utilities are tied to the .dark class on <html> (a class-based variant)", () => {
    expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *));");
  });
  it("first-time visitors get their device's theme (they can then pick light or dark and it is remembered)", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/defaultTheme="light"/); // light is the primary look
    expect(layout).toMatch(/enableSystem/);
    expect(layout).toMatch(/enableSystem/);
  });
});

describe("Auth layout — cinematic split", () => {
  it("desktop shows the product story with three floating cards; phones get a slim one-card version", async () => {
    await renderLayout(<form aria-label="login form" />);
    const showcase = screen.getByTestId("auth-showcase");
    expect(showcase).toHaveClass("hidden", "lg:flex");
    expect(showcase).toHaveTextContent("Hisaab saaf.");
    expect(showcase).toHaveTextContent("Dosti barkaraar.");
    expect(showcase).toHaveTextContent(/bhai, paise kab doge/);
    expect(showcase).toHaveTextContent("₹18,450");
    expect(showcase).toHaveTextContent("+ ₹2,840");
    expect(showcase).toHaveTextContent("₹640");
    expect(showcase).toHaveTextContent("Smart settle-up");
    expect(showcase).toHaveTextContent(/10\s*3/);
    expect(screen.getByTestId("showcase-cards")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("auth-mobile-hero")).toHaveClass("lg:hidden");
  });

  it("outside India the cards and words carry no rupees or Hindi", async () => {
    await renderLayout(<div />, "US");
    const text = (screen.getByTestId("auth-showcase").textContent ?? "") + (screen.getByTestId("auth-mobile-hero").textContent ?? "");
    expect(text).not.toMatch(/₹|bhai|Hisaab|Dosti/);
    expect(text).toContain("$920");
  });

  it("the page tells the cards what the person is doing: email → closer, password → softer, submit → away", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const { container } = await renderLayout(<form aria-label="login form" onSubmit={(e) => e.preventDefault()}><input id="email" aria-label="e" /><input id="password" aria-label="p" /><button type="submit">go</button></form>);
    const stage = container.firstElementChild!;
    expect(stage).toHaveAttribute("data-stage", "idle");
    await userEvent.click(screen.getByLabelText("e"));
    expect(stage).toHaveAttribute("data-stage", "email");
    await userEvent.click(screen.getByLabelText("p"));
    expect(stage).toHaveAttribute("data-stage", "password");
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(stage).toHaveAttribute("data-stage", "leaving");
  });

  it("the card reactions and floating are plain CSS, and the floating stops for reduced motion", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain('[data-stage="password"] .showcase-stage .showcase-card { opacity: 0.55; filter: blur(3px); }');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*anim-float-slow/);
  });
});
