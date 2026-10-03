import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createHarness } from "../hooks/harness";

const h = vi.hoisted(() => ({ setTheme: vi.fn(), theme: { value: "system" }, profile: { data: undefined as unknown }, toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: h.theme.value, setTheme: h.setTheme }) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => h.profile }));
vi.mock("@/components/settings/notification-settings", () => ({ NotificationSettings: () => <div data-testid="notification-settings" /> }));
vi.mock("@/components/settings/upi-settings", () => ({ UpiSettings: () => <div data-testid="upi-settings" /> }));

import SettingsPage from "@/app/(dashboard)/settings/page";

const renderPage = () => { const harness = createHarness(); render(<SettingsPage />, { wrapper: harness.wrapper }); return harness; };

beforeEach(() => {
  vi.clearAllMocks();
  h.theme.value = "system";
  h.profile.data = { currency: "INR" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: {} }) }));
});

describe("SettingsPage", () => {
  it("has every section", () => {
    renderPage();
    for (const heading of ["Appearance", "Notifications", "Get paid faster", "Import", "Home currency", "Data", "Privacy & Security"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByTestId("notification-settings")).toBeInTheDocument();
    expect(screen.getByTestId("upi-settings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /import from splitwise/i })).toHaveAttribute("href", "/import");
  });

  it("switches the theme and highlights the current one", async () => {
    h.theme.value = "dark";
    renderPage();
    expect(screen.getByRole("button", { name: "Dark" }).className).toContain("border-primary");
    expect(screen.getByRole("button", { name: "Light" }).className).not.toContain("border-primary");
    await userEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(h.setTheme).toHaveBeenCalledWith("light");
  });

  describe("home currency explanation", () => {
    it("tells the user exactly what the setting does", () => {
      renderPage();
      const help = screen.getByTestId("currency-help");
      expect(help).toHaveTextContent("Your home currency is used for");
      expect(help).toHaveTextContent(/dashboard/i);
      expect(help).toHaveTextContent(/analytics/i);
      expect(help).toHaveTextContent(/default for new groups and for expenses you add outside a group/i);
      expect(help).toHaveTextContent(/≈ total/);
    });

    it("is honest about its limits: existing data keeps its currency and currencies are never mixed", () => {
      renderPage();
      const help = screen.getByTestId("currency-help");
      expect(help).toHaveTextContent(/existing groups and expenses keep their own currency/i);
      expect(help).toHaveTextContent(/never added together/i);
    });

    it("no longer claims to only affect how the dashboard is displayed", () => {
      renderPage();
      expect(screen.queryByText(/sets how amounts are displayed on the dashboard/i)).not.toBeInTheDocument();
    });
  });

  describe("default currency", () => {
    it("shows the saved currency (INR by default before the profile loads)", () => {
      h.profile.data = undefined;
      const { unmount } = (renderPage(), { unmount: () => {} });
      expect(screen.getByRole("combobox")).toHaveTextContent("INR");
      unmount();
    });

    it("reflects a saved non-INR currency once the profile loads", () => {
      h.profile.data = { currency: "USD" };
      renderPage();
      expect(screen.getByRole("combobox")).toHaveTextContent("USD");
    });

    it("lists INR first", async () => {
      renderPage();
      await userEvent.click(screen.getByRole("combobox"));
      const options = within(await screen.findByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
      expect(options[0]).toBe("INR");
      expect(options).toHaveLength(7);
    });

    it("saves a change to the profile, refreshes the dashboard, and confirms", async () => {
      const { invalidated } = renderPage();
      await userEvent.click(screen.getByRole("combobox"));
      await userEvent.click(await screen.findByRole("option", { name: "EUR" }));
      await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Default currency updated"));
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("/api/profile");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ currency: "EUR" });
      expect(invalidated()).toEqual(expect.arrayContaining([["dashboard"], ["profile"]]));
    });

    it("shows the server's error if saving fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Invalid currency" } }) }));
      renderPage();
      await userEvent.click(screen.getByRole("combobox"));
      await userEvent.click(await screen.findByRole("option", { name: "GBP" }));
      await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Invalid currency"));
    });
  });

  it("Export downloads the CSV", async () => {
    const loc = { href: "" };
    vi.stubGlobal("location", loc);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /export all expenses/i }));
    expect(loc.href).toBe("/api/export");
  });

  it("Download my data gets the full JSON export", async () => {
    const loc = { href: "" };
    vi.stubGlobal("location", loc);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /download all my data/i }));
    expect(loc.href).toBe("/api/account/export");
  });

  it("Delete account opens a confirmation — it never deletes on the first click", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/can't be undone/i);
    expect(fetch).not.toHaveBeenCalledWith("/api/account", expect.anything());
  });
});
