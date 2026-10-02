import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  ui: { commandPaletteOpen: false, mobileMenuOpen: false, setCommandPaletteOpen: vi.fn(), setAddExpenseOpen: vi.fn(), setMobileMenuOpen: vi.fn() },
  push: vi.fn(), setTheme: vi.fn(), resolvedTheme: { value: "light" }, signOut: vi.fn(), pathname: { value: "/dashboard" },
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/stores/ui-store", () => ({ useUIStore: () => h.ui }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }), usePathname: () => h.pathname.value }));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: h.setTheme, resolvedTheme: h.resolvedTheme.value }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { email: "me@x.com", user_metadata: { name: "Nishant Kumar" } }, signOut: h.signOut }) }));

import { CommandPalette } from "@/components/layout/command-palette";
import { MobileDrawer } from "@/components/layout/mobile-drawer";

beforeEach(() => {
  vi.clearAllMocks();
  h.ui.commandPaletteOpen = false; h.ui.mobileMenuOpen = false;
  h.resolvedTheme.value = "light"; h.pathname.value = "/dashboard";
  h.signOut.mockResolvedValue(undefined);
});

describe("CommandPalette", () => {
  it("is closed by default", () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(/search or jump to/i)).not.toBeInTheDocument();
  });

  it("⌘K / Ctrl+K toggles it", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(h.ui.setCommandPaletteOpen).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(h.ui.setCommandPaletteOpen).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: "k" }); // plain "k" must not trigger
    expect(h.ui.setCommandPaletteOpen).toHaveBeenCalledTimes(2);
  });

  it("closes when ⌘K is pressed while open", () => {
    h.ui.commandPaletteOpen = true;
    const { rerender } = render(<CommandPalette />);
    rerender(<CommandPalette />); // let the ref effect see the open state
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(h.ui.setCommandPaletteOpen).toHaveBeenLastCalledWith(false);
  });

  it("lists every page and the quick actions", () => {
    h.ui.commandPaletteOpen = true;
    render(<CommandPalette />);
    for (const label of ["Dashboard", "Groups", "Expenses", "Friends", "Activity", "Analytics", "Settings", "New expense", "New group", "Add friend"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("jumping to a page closes the palette and navigates", async () => {
    h.ui.commandPaletteOpen = true;
    render(<CommandPalette />);
    await userEvent.click(screen.getByText("Analytics"));
    expect(h.push).toHaveBeenCalledWith("/analytics");
    expect(h.ui.setCommandPaletteOpen).toHaveBeenCalledWith(false);
  });

  it("'New expense' opens the add-expense dialog (it doesn't navigate)", async () => {
    h.ui.commandPaletteOpen = true;
    render(<CommandPalette />);
    await userEvent.click(screen.getByText("New expense"));
    expect(h.ui.setAddExpenseOpen).toHaveBeenCalledWith(true);
    expect(h.ui.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("'New group' and 'Add friend' take you to the right page", async () => {
    h.ui.commandPaletteOpen = true;
    render(<CommandPalette />);
    await userEvent.click(screen.getByText("New group"));
    expect(h.push).toHaveBeenLastCalledWith("/groups");
    await userEvent.click(screen.getByText("Add friend"));
    expect(h.push).toHaveBeenLastCalledWith("/friends");
  });

  it("filters as you type and shows an empty message when nothing matches", async () => {
    h.ui.commandPaletteOpen = true;
    render(<CommandPalette />);
    await userEvent.type(screen.getByPlaceholderText(/search or jump to/i), "anal");
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.queryByText("Friends")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText(/search or jump to/i));
    await userEvent.type(screen.getByPlaceholderText(/search or jump to/i), "zzzzz");
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("offers the opposite theme and switches to it", async () => {
    h.ui.commandPaletteOpen = true;
    const { unmount } = render(<CommandPalette />);
    await userEvent.click(screen.getByText("Switch to dark mode"));
    expect(h.setTheme).toHaveBeenLastCalledWith("dark");
    expect(h.ui.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    unmount();
    h.resolvedTheme.value = "dark";
    render(<CommandPalette />);
    await userEvent.click(screen.getByText("Switch to light mode"));
    expect(h.setTheme).toHaveBeenLastCalledWith("light");
  });
});

describe("MobileDrawer", () => {
  it("renders nothing while closed", () => {
    render(<MobileDrawer />);
    expect(screen.queryByRole("link", { name: /groups/i })).not.toBeInTheDocument();
  });

  it("lists the app's sections with the user's name and highlights the current page", () => {
    h.ui.mobileMenuOpen = true;
    h.pathname.value = "/groups/abc";
    render(<MobileDrawer />);
    for (const name of ["Dashboard", "Groups", "Expenses", "Friends", "Activity", "Analytics", "Recurring"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Groups" }).className).toContain("text-primary");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("text-primary");
  });

  it("tapping a link closes the drawer", async () => {
    h.ui.mobileMenuOpen = true;
    render(<MobileDrawer />);
    await userEvent.click(screen.getByRole("link", { name: "Friends" }));
    expect(h.ui.setMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it("tapping the dimmed backdrop closes it", async () => {
    h.ui.mobileMenuOpen = true;
    const { container } = render(<MobileDrawer />);
    await userEvent.click(container.querySelector("div.fixed.inset-0") as HTMLElement);
    expect(h.ui.setMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it("signs out, closes the drawer and returns to login", async () => {
    h.ui.mobileMenuOpen = true;
    render(<MobileDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(h.ui.setMobileMenuOpen).toHaveBeenCalledWith(false);
    await vi.waitFor(() => expect(h.signOut).toHaveBeenCalled());
    await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/login"));
    expect(h.toast.success).toHaveBeenCalledWith("Signed out");
  });
});
