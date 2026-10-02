import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const prefetch = vi.fn();
const setAddExpenseOpen = vi.fn();
const setCommandPaletteOpen = vi.fn();
const toggleSidebar = vi.fn();
const ui = { sidebarOpen: true };
vi.mock("@/stores/ui-store", () => ({
  useUIStore: () => ({
    sidebarOpen: ui.sidebarOpen, toggleSidebar, toggleMobileMenu: vi.fn(),
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

beforeEach(() => { vi.clearAllMocks(); ui.sidebarOpen = true; });

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

describe("Sidebar — collapse control (ChatGPT/Claude style: in the header, not floating on the edge)", () => {
  it("expanded: a panel button in the header collapses it, and the app name is visible", async () => {
    render(<Sidebar />);
    expect(screen.getByText("Splitr Pro")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(toggleSidebar).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
  });

  it("collapsed: the logo is the expand button, the name is hidden, and clicking expands", async () => {
    ui.sidebarOpen = false;
    render(<Sidebar />);
    expect(screen.queryByText("Splitr Pro")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(toggleSidebar).toHaveBeenCalledOnce();
  });

  it("has no floating edge button any more (the old half-clipped chevron circle)", () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector("button.absolute.-right-3")).toBeNull();
    expect(container.querySelectorAll("button[aria-label$='sidebar']")).toHaveLength(1);
  });

  it("⌘B and Ctrl+B toggle it", () => {
    render(<Sidebar />);
    fireEvent.keyDown(document.body, { key: "b", metaKey: true });
    fireEvent.keyDown(document.body, { key: "B", ctrlKey: true });
    expect(toggleSidebar).toHaveBeenCalledTimes(2);
  });

  it("a plain 'b' or other shortcuts do nothing", () => {
    render(<Sidebar />);
    fireEvent.keyDown(document.body, { key: "b" });
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    expect(toggleSidebar).not.toHaveBeenCalled();
  });

  it("the shortcut is ignored while typing in a field", () => {
    render(<><Sidebar /><input aria-label="notes" /></>);
    fireEvent.keyDown(screen.getByLabelText("notes"), { key: "b", metaKey: true });
    expect(toggleSidebar).not.toHaveBeenCalled();
  });

  it("stops listening when the sidebar unmounts", () => {
    const { unmount } = render(<Sidebar />);
    unmount();
    fireEvent.keyDown(document.body, { key: "b", metaKey: true });
    expect(toggleSidebar).not.toHaveBeenCalled();
  });

  it("collapsed, the navigation still works (icons only)", () => {
    ui.sidebarOpen = false;
    render(<Sidebar />);
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(7);
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
