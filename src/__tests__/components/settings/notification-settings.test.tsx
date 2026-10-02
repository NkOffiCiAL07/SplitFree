import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push, toast, useProfile } = vi.hoisted(() => ({
  push: {
    isPushSupported: vi.fn(),
    getPushSubscription: vi.fn(),
    enablePush: vi.fn(),
    disablePush: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
  useProfile: vi.fn(),
}));
vi.mock("@/lib/push-client", () => push);
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => useProfile() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

import { NotificationSettings } from "@/components/settings/notification-settings";

beforeEach(() => {
  vi.clearAllMocks();
  useProfile.mockReturnValue({ data: { emailNotifications: true } });
  push.isPushSupported.mockReturnValue(true);
  push.getPushSubscription.mockResolvedValue(null);
  push.disablePush.mockResolvedValue(true);
  vi.stubGlobal("Notification", { permission: "default" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: {} }) }));
});

describe("NotificationSettings — push", () => {
  it("is off by default and turning it on subscribes this device", async () => {
    push.enablePush.mockResolvedValue({ ok: true });
    render(<NotificationSettings />);
    const toggle = await screen.findByRole("switch", { name: /push notifications/i });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(push.enablePush).toHaveBeenCalled();
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/enabled/i));
  });

  it("explains a blocked permission instead of silently failing", async () => {
    push.enablePush.mockResolvedValue({ ok: false, reason: "denied" });
    render(<NotificationSettings />);
    const toggle = await screen.findByRole("switch", { name: /push notifications/i });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/blocked/i));
    expect(toggle).not.toBeChecked();
  });

  it("reflects an existing subscription and can turn it off", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    push.getPushSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    render(<NotificationSettings />);
    const toggle = await screen.findByRole("switch", { name: /push notifications/i });
    await waitFor(() => expect(toggle).toBeChecked());
    await userEvent.click(toggle);
    expect(push.disablePush).toHaveBeenCalled();
    await waitFor(() => expect(toggle).not.toBeChecked());
  });

  it("is disabled with an explanation when the browser can't do push", async () => {
    push.isPushSupported.mockReturnValue(false);
    render(<NotificationSettings />);
    const toggle = await screen.findByRole("switch", { name: /push notifications/i });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/not supported in this browser/i)).toBeInTheDocument();
  });
});

describe("NotificationSettings — email", () => {
  it("reflects the saved preference and saves changes to the account", async () => {
    render(<NotificationSettings />);
    const toggle = await screen.findByRole("switch", { name: /email notifications/i });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/profile");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ emailNotifications: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Email notifications off"));
  });

  it("shows an error when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "nope" } }) }));
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: /email notifications/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
  });

  it("is disabled until the profile has loaded", async () => {
    useProfile.mockReturnValue({ data: undefined });
    render(<NotificationSettings />);
    expect(await screen.findByRole("switch", { name: /email notifications/i })).toBeDisabled();
  });
});
