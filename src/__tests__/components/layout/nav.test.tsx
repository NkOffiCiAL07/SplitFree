import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const prefetch = vi.fn();
const setAddExpenseOpen = vi.fn();
const setCommandPaletteOpen = vi.fn();
vi.mock("@/stores/ui-store", () => ({
  useUIStore: () => ({
    sidebarOpen: true, toggleSidebar: vi.fn(), toggleMobileMenu: vi.fn(),
    setAddExpenseOpen, setCommandPaletteOpen,
  }),
}));
vi.mock("@/hooks/use-prefetch", () => ({
  usePrefetchOnIntent: () => (href: string) => ({ onMouseEnter: () => prefetch("hover", href), onFocus: () => prefetch("focus", href), onTouchStart: () => prefetch("touch", href) }),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "me@example.com", user_metadata: { name: "Me" } }, signOut: vi.fn() }),
}));
vi.mock("@/components/layout/notification-bell", () => ({ NotificationBell: () => <div data-testid="bell" /> }));
vi.mock("@/components/layout/theme-toggle", () => ({ ThemeToggle: () => <div data-testid="theme" /> }));

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

beforeEach(() => vi.clearAllMocks());

describe("Sidebar", () => {
  it("has no Add expense button (adding is done from pages, the mobile + button and the command palette)", () => {
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /add expense/i })).not.toBeInTheDocument();
    expect(setAddExpenseOpen).not.toHaveBeenCalled();
  });

  it("links to the main sections", () => {
    render(<Sidebar />);
    for (const name of ["Dashboard", "Groups", "Expenses", "Friends", "Activity", "Analytics", "Recurring"]) {
      expect(screen.getByRole("link", { name: new RegExp(name, "i") })).toBeInTheDocument();
    }
  });
});

describe("Sidebar — prefetching on intent", () => {
  it("hovering, focusing or touching a link starts loading that page's data", async () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /groups/i });
    await userEvent.hover(link);
    expect(prefetch).toHaveBeenCalledWith("hover", "/groups");
    link.focus();
    expect(prefetch).toHaveBeenCalledWith("focus", "/groups");
  });
});

describe("TopNav", () => {
  it("no longer renders an Add expense button", () => {
    render(<TopNav />);
    expect(screen.queryByRole("button", { name: /add expense/i })).not.toBeInTheDocument();
  });

  it("keeps search, notifications and theme controls", async () => {
    render(<TopNav />);
    expect(screen.getByTestId("bell")).toBeInTheDocument();
    expect(screen.getByTestId("theme")).toBeInTheDocument();
    await userEvent.click(screen.getAllByText(/search/i)[0]);
    expect(setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });
});
