import { describe, it, expect, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ signInWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signUpWithEmail: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FillProvider, useReportFill } from "@/components/auth/fill-context";
import { FillingPot } from "@/components/auth/filling-pot";
import LoginForm from "@/app/(auth)/login/login-form";
import SignupForm from "@/app/(auth)/signup/signup-form";

const lg = () => screen.getByTestId("filling-pot-lg");
const water = (el: HTMLElement) => el.querySelector(".fill-level") as HTMLElement;

function Report({ level }: { level: number }) { useReportFill(level); return null; }

describe("FillingPot", () => {
  it("is empty at first: no bubbles, drops or sparkles, and invites you to start typing", () => {
    render(<FillProvider><FillingPot /></FillProvider>);
    expect(lg()).toHaveAttribute("data-mood", "empty");
    expect(lg().querySelector(".fill-drip")).toBeNull();
    expect(lg().querySelector(".fill-sparkle")).toBeNull();
    expect(screen.getByTestId("fill-caption")).toHaveTextContent(/start typing/i);
  });

  it("the water level follows the reported progress (translateY shrinks as it fills)", () => {
    const { rerender } = render(<FillProvider><Report level={0} /><FillingPot /></FillProvider>);
    const y = () => parseFloat(water(lg()).style.transform.match(/translateY\(([\d.]+)px\)/)![1]);
    const empty = y();
    rerender(<FillProvider><Report level={0.5} /><FillingPot /></FillProvider>);
    expect(y()).toBeCloseTo(empty / 2, 0);
    rerender(<FillProvider><Report level={1} /><FillingPot /></FillProvider>);
    expect(y()).toBe(0);
  });

  it("shows falling drops and bubbles while filling, and sparkles + 'Full' at the top", () => {
    const { rerender } = render(<FillProvider><Report level={0.4} /><FillingPot /></FillProvider>);
    expect(lg()).toHaveAttribute("data-mood", "filling");
    expect(lg().querySelectorAll(".fill-drip").length).toBeGreaterThan(0);
    expect(lg().querySelectorAll(".fill-bubble").length).toBeGreaterThan(0);
    rerender(<FillProvider><Report level={1} /><FillingPot /></FillProvider>);
    expect(lg()).toHaveAttribute("data-mood", "full");
    expect(lg().querySelector(".fill-drip")).toBeNull();
    expect(lg().querySelectorAll(".fill-sparkle").length).toBeGreaterThan(0);
    expect(screen.getByTestId("fill-caption")).toHaveTextContent(/full/i);
  });

  it("is decorative (hidden from screen readers) with a polite live status caption", () => {
    render(<FillProvider><FillingPot /></FillProvider>);
    expect(lg().querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("the small version (for phones) has no caption and its own ids, so two pots never clash", () => {
    render(<FillProvider><FillingPot size="lg" /><FillingPot size="sm" /></FillProvider>);
    expect(screen.getByTestId("filling-pot-sm").querySelector("figcaption")).toBeNull();
    const ids = [...document.querySelectorAll("clipPath")].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("empties again when the form goes away", () => {
    const { rerender } = render(<FillProvider><Report level={1} /><FillingPot /></FillProvider>);
    expect(lg()).toHaveAttribute("data-mood", "full");
    rerender(<FillProvider><FillingPot /></FillProvider>);
    expect(lg()).toHaveAttribute("data-mood", "empty");
  });
});

describe("the pot fills as you fill in the sign-in form", () => {
  const setup = () => render(<FillProvider><FillingPot /><LoginForm /></FillProvider>);

  it("starts empty, rises as you type the email, and is full when email and password are done", async () => {
    setup();
    expect(lg()).toHaveAttribute("data-level", "0");

    await userEvent.type(screen.getByLabelText("Email"), "me@exam");
    const partial = Number(lg().getAttribute("data-level"));
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(0.5);

    await userEvent.type(screen.getByLabelText("Email"), "ple.com");
    expect(lg()).toHaveAttribute("data-level", "0.5");

    await userEvent.type(screen.getByLabelText("Password"), "abc");
    expect(Number(lg().getAttribute("data-level"))).toBeGreaterThan(0.5);
    await userEvent.type(screen.getByLabelText("Password"), "def");
    expect(lg()).toHaveAttribute("data-level", "1");
    expect(lg()).toHaveAttribute("data-mood", "full");
  });

  it("drains if you delete what you typed", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    expect(lg()).toHaveAttribute("data-level", "0.5");
    await userEvent.clear(screen.getByLabelText("Email"));
    expect(lg()).toHaveAttribute("data-level", "0");
  });

  it("sign-up counts its four fields (name, mobile number, email, password)", async () => {
    render(<FillProvider><FillingPot /><SignupForm /></FillProvider>);
    await userEvent.type(screen.getByLabelText("Full name"), "Asha");
    expect(Number(lg().getAttribute("data-level"))).toBeCloseTo(1 / 4, 2);
    await userEvent.type(screen.getByLabelText("Mobile number"), "98765 43210");
    expect(Number(lg().getAttribute("data-level"))).toBeCloseTo(2 / 4, 2);
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "longpassword1");
    expect(lg()).toHaveAttribute("data-level", "1");
  });

  it("leaves the form itself untouched: still only Sign in, Google and the sign-up link", () => {
    setup();
    const form = screen.getByRole("button", { name: /^sign in$/i });
    expect(form).toBeInTheDocument();
    expect(within(document.body).getAllByRole("button", { name: /continue with google/i })).toHaveLength(1);
    void act;
  });
});
