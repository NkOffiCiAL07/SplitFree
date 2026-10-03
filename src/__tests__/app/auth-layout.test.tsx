import { describe, it, expect } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import AuthLayout, { metadata } from "@/app/(auth)/layout";
import { OCCASIONS, HEADLINE } from "@/lib/brand-copy";

describe("Auth layout — welcome for phones (and the Android app when signed out)", () => {
  it("shows what the app is above the form: name, tagline and the key benefits", () => {
    render(<AuthLayout><form aria-label="login form" /></AuthLayout>);
    const welcome = screen.getByTestId("welcome");
    expect(welcome).toHaveTextContent("Splitr Pro");
    expect(welcome).toHaveTextContent("Hisaab saaf. Dosti barkaraar.");
    expect(welcome).toHaveTextContent(/bhai, paise kab doge/);
    for (const benefit of ["UPI pay links", "Works offline", "Smart settle-up", "No ads"]) {
      expect(within(welcome).getByText(benefit)).toBeInTheDocument();
    }
  });

  it("is only for small screens (the desktop already has the branding panel) and is a labelled region", () => {
    render(<AuthLayout><div /></AuthLayout>);
    expect(screen.getByTestId("welcome")).toHaveClass("lg:hidden");
    expect(screen.getByRole("region", { name: "Welcome" })).toBeInTheDocument();
  });

  it("puts the welcome ABOVE the form it wraps, and still renders the form", () => {
    render(<AuthLayout><form aria-label="login form" /></AuthLayout>);
    const welcome = screen.getByTestId("welcome");
    const form = screen.getByRole("form", { name: "login form" });
    expect(welcome.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the 'Sign in' page title", () => {
    expect(metadata.title).toBe("Sign in");
  });
});

describe("Auth layout — liquid glass", () => {
  it("puts the form on a frosted-glass card and keeps the decorative colour blobs out of the accessibility tree", () => {
    const { container } = render(<AuthLayout><form aria-label="login form" /></AuthLayout>);
    const card = screen.getByRole("form", { name: "login form" }).parentElement!;
    expect(card).toHaveClass("lg-glass");
    const blobs = container.querySelectorAll(".lg-blob");
    expect(blobs.length).toBeGreaterThan(3);
    for (const b of blobs) expect(b.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("the desktop panel carries the new tagline, plain-words subline and trust points", () => {
    const { container } = render(<AuthLayout><div /></AuthLayout>);
    const panel = container.querySelector("h2")!.parentElement!;
    expect(panel).toHaveTextContent("Hisaab saaf.");
    expect(panel).toHaveTextContent("Dosti barkaraar.");
    expect(panel).toHaveTextContent(/split trips, rent and dinners with friends, then settle up on UPI in one tap/i);
    for (const t of ["Free forever", "No ads", "Works offline"]) expect(within(panel).getByText(t)).toBeInTheDocument();
    expect(HEADLINE).toBe("Hisaab saaf. Dosti barkaraar.");
  });

  it("floating glass chips show the product in action (they're decoration, not required reading)", () => {
    const { container } = render(<AuthLayout><div /></AuthLayout>);
    expect(container.querySelectorAll(".lg-glass-dark.lg-float, .lg-glass-dark.lg-float-2, .lg-glass-dark.lg-float-3")).toHaveLength(3);
    expect(container.textContent).toMatch(/Asha paid you ₹850/);
  });
});

describe("Rotating occasions", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("cycles through what the app is for, and screen readers get the list once", () => {
    render(<AuthLayout><div /></AuthLayout>);
    const words = () => screen.getAllByTestId("rotating-word").map((w) => w.textContent);
    expect(words()).toEqual([OCCASIONS[0], OCCASIONS[0]]); // desktop + phone copies
    act(() => { vi.advanceTimersByTime(2700); });
    expect(words()[0]).toBe(OCCASIONS[1]);
    act(() => { vi.advanceTimersByTime(2600 * OCCASIONS.length); });
    expect(OCCASIONS).toContain(words()[0]);
    expect(screen.getAllByText(OCCASIONS.join(", "), { selector: ".sr-only" }).length).toBeGreaterThan(0);
  });
});
