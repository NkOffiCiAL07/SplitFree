import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Real localStorage (Node 26's built-in one is unusable) for the onboarding banner
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear(),
    },
  });
});

const { setTheme, theme, user, push, uiState, pathname, prefetch } = vi.hoisted(() => ({
  prefetch: vi.fn(),
  setTheme: vi.fn(), theme: { value: "system" }, user: { value: null as null | { email: string } }, push: vi.fn(),
  uiState: { setAddExpenseOpen: vi.fn(), addExpenseOpen: false },
  pathname: { value: "/dashboard" },
}));
vi.mock("@/hooks/use-prefetch", () => ({
  usePrefetchOnIntent: () => (href: string) => ({ onMouseEnter: () => prefetch(href), onFocus: () => prefetch(href), onTouchStart: () => prefetch(href) }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme, theme: theme.value }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: user.value }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => pathname.value }));
vi.mock("@/stores/ui-store", () => ({ useUIStore: () => uiState }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    // Render the dynamically-imported dialog as a marker so we can see when it mounts
    void loader;
    return ({ open }: { open: boolean }) => <div data-testid="add-expense-dialog" data-open={String(open)} />;
  },
}));

import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { ServiceWorkerRegistration } from "@/components/shared/sw-register";
import { GlobalAddExpenseDialog } from "@/components/expenses/global-add-expense-dialog";

beforeEach(() => { vi.clearAllMocks(); theme.value = "system"; user.value = null; pathname.value = "/dashboard"; localStorage.clear(); });
afterEach(() => vi.unstubAllEnvs());

describe("MobileNav", () => {
  it("has the five tabs, with the centre button opening the add-expense dialog", async () => {
    render(<MobileNav />);
    for (const [name, href] of [["Home", "/dashboard"], ["Groups", "/groups"], ["Friends", "/friends"], ["Stats", "/analytics"]]) {
      expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
    }
    await userEvent.click(screen.getByRole("button", { name: /add expense/i }));
    expect(uiState.setAddExpenseOpen).toHaveBeenCalledWith(true);
  });

  it("touching a tab starts loading its data before the tap completes", async () => {
    render(<MobileNav />);
    fireEvent.touchStart(screen.getByRole("link", { name: /friends/i }));
    expect(prefetch).toHaveBeenCalledWith("/friends");
  });

  it("highlights the current section, including sub-pages", () => {
    pathname.value = "/groups/abc";
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: /groups/i }).className).toContain("text-primary");
    expect(screen.getByRole("link", { name: /home/i }).className).not.toContain("text-primary");
  });
});

describe("ThemeToggle", () => {
  it("offers light, dark and system and applies the choice", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /dark/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /light/i }));
    expect(setTheme).toHaveBeenLastCalledWith("light");
  });

  it("marks the current theme", async () => {
    theme.value = "dark";
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect((await screen.findByRole("menuitem", { name: /dark/i })).textContent).toContain("✓");
    expect(screen.getByRole("menuitem", { name: /light/i }).textContent).not.toContain("✓");
  });
});

describe("DemoBanner", () => {
  it("appears only for the configured demo account, and can be dismissed", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMAIL", "demo@x.com");
    user.value = { email: "demo@x.com" };
    render(<DemoBanner />);
    expect(screen.getByText(/demo account/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create your free account/i })).toHaveAttribute("href", "/signup");
    await userEvent.click(screen.getByRole("button"));
    expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
  });

  it("never shows for normal users, signed-out visitors, or when no demo account is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMAIL", "demo@x.com");
    user.value = { email: "someone@x.com" };
    const { container, rerender } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
    user.value = null;
    rerender(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
    vi.stubEnv("NEXT_PUBLIC_DEMO_EMAIL", "");
    user.value = { email: "demo@x.com" };
    rerender(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OnboardingBanner", () => {
  it("shows the first step for new users and walks through three steps to their destinations", async () => {
    render(<OnboardingBanner />);
    expect(await screen.findByText("Create your first group")).toBeInTheDocument();
    expect(screen.getByText(/getting started · 1\/3/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /create group/i }));
    expect(push).toHaveBeenCalledWith("/groups");
  });

  it("can be dismissed, and stays dismissed", async () => {
    const { unmount } = render(<OnboardingBanner />);
    await userEvent.click(await screen.findByRole("button", { name: /dismiss/i }));
    await waitFor(() => expect(screen.queryByText("Create your first group")).not.toBeInTheDocument());
    expect(localStorage.getItem("splitfree_onboarding_dismissed")).toBe("1");
    unmount();
    render(<OnboardingBanner />);
    expect(screen.queryByText("Create your first group")).not.toBeInTheDocument();
  });

  it("doesn't show for users who dismissed it before", () => {
    localStorage.setItem("splitfree_onboarding_dismissed", "1");
    render(<OnboardingBanner />);
    expect(screen.queryByText(/getting started/i)).not.toBeInTheDocument();
  });
});

describe("ServiceWorkerRegistration", () => {
  const register = vi.fn();
  beforeEach(() => { register.mockReset().mockResolvedValue({}); Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } }); });

  it("registers the service worker in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<ServiceWorkerRegistration />);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("doesn't register in development (stale caches make local work confusing)", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<ServiceWorkerRegistration />);
    expect(register).not.toHaveBeenCalled();
  });

  it("swallows registration failures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    register.mockRejectedValue(new Error("blocked"));
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});

describe("GlobalAddExpenseDialog", () => {
  it("loads nothing until the dialog is first opened (keeps the dashboard light)", () => {
    uiState.addExpenseOpen = false;
    render(<GlobalAddExpenseDialog />);
    expect(screen.queryByTestId("add-expense-dialog")).not.toBeInTheDocument();
  });

  it("mounts the dialog once opened, and keeps it mounted (so it can animate closed) afterwards", () => {
    uiState.addExpenseOpen = true;
    const { rerender } = render(<GlobalAddExpenseDialog />);
    expect(screen.getByTestId("add-expense-dialog")).toHaveAttribute("data-open", "true");
    uiState.addExpenseOpen = false;
    rerender(<GlobalAddExpenseDialog />);
    expect(screen.getByTestId("add-expense-dialog")).toHaveAttribute("data-open", "false");
  });
});
