import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/login", search: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useSearchParams: () => new URLSearchParams(nav.search) }));

import { AuthTabs } from "@/components/auth/auth-tabs";

beforeEach(() => { nav.path = "/login"; nav.search = ""; });

describe("AuthTabs", () => {
  it("marks the current page and links to the other one", () => {
    render(<AuthTabs />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Create account" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup");
  });

  it("on the sign-up page the highlight moves to Create account", () => {
    nav.path = "/signup";
    render(<AuthTabs />);
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("keeps the invite link destination when switching (so a new friend still ends up in the group)", () => {
    nav.search = "redirect=/join/abc123";
    render(<AuthTabs />);
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup?redirect=%2Fjoin%2Fabc123");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirect=%2Fjoin%2Fabc123");
  });

  it("shows nothing on other auth pages (e.g. reset password) and is desktop-only", () => {
    nav.path = "/reset-password";
    const { container } = render(<AuthTabs />);
    expect(container).toBeEmptyDOMElement();
    nav.path = "/login";
    render(<AuthTabs />);
    expect(screen.getByTestId("auth-tabs")).toHaveClass("hidden", "lg:grid");
  });
});
