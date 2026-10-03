import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AuthLayout, { metadata } from "@/app/(auth)/layout";

describe("Auth layout — welcome for phones (and the Android app when signed out)", () => {
  it("shows what the app is above the form: name, tagline and the key benefits", () => {
    render(<AuthLayout><form aria-label="login form" /></AuthLayout>);
    const welcome = screen.getByTestId("welcome");
    expect(welcome).toHaveTextContent("Splitr Pro");
    expect(welcome).toHaveTextContent("Split expenses, not friendships.");
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
