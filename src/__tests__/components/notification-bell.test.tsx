import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createHarness } from "../hooks/harness";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { NotificationBell } from "@/components/layout/notification-bell";

type Notif = { id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string; data?: unknown };
const n = (over: Partial<Notif>): Notif => ({ id: "n1", type: "EXPENSE_ADDED", title: "Asha added an expense", body: "Dinner — your share: ₹100.00", isRead: false, createdAt: new Date().toISOString(), data: null, ...over });

/** fetch stub that serves the notifications list and records every call */
function setup(list: Notif[], extra?: (url: string, init?: RequestInit) => unknown) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
    const custom = extra?.(url, init);
    if (custom !== undefined) return { ok: true, json: async () => custom };
    return { ok: true, json: async () => ({ data: list }) };
  }));
  const { wrapper } = createHarness();
  render(<NotificationBell />, { wrapper });
  return calls;
}
const openMenu = async () => { await userEvent.click(await screen.findByRole("button", { name: /notifications/i })); return screen.findByRole("menu"); };

beforeEach(() => vi.clearAllMocks());

describe("NotificationBell", () => {
  it("shows the unread count on the bell", async () => {
    setup([n({ id: "1" }), n({ id: "2" }), n({ id: "3", isRead: true })]);
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("shows no badge when everything is read", async () => {
    setup([n({ isRead: true })]);
    await screen.findByRole("button", { name: /notifications/i });
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });

  it("lists notifications and links to the full activity page", async () => {
    setup([n({ title: "Asha added an expense" }), n({ id: "2", title: "Payment received", isRead: true })]);
    const menu = await openMenu();
    expect(within(menu).getByText("Asha added an expense")).toBeInTheDocument();
    expect(within(menu).getByText("Payment received")).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /view all activity/i })).toHaveAttribute("href", "/activity");
  });

  it("has a friendly empty state", async () => {
    setup([]);
    expect(within(await openMenu()).getByText("No notifications yet")).toBeInTheDocument();
  });

  it("Mark all read updates the UI and tells the server (the server remembers it, like a real one)", async () => {
    const list = [n({ id: "1" }), n({ id: "2" })];
    const calls = setup(list, (url, init) => {
      if (init?.method === "PATCH") { list.forEach((x) => { x.isRead = true; }); return { data: { updated: true } }; }
      return undefined;
    });
    const menu = await openMenu();
    await userEvent.click(within(menu).getByRole("button", { name: /mark all read/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ url: "/api/notifications", body: { markAll: true } });
    expect(screen.queryByText("2", { selector: "span.gradient-brand" })).not.toBeInTheDocument(); // badge gone
  });

  it("tapping an unread notification marks just that one as read", async () => {
    const calls = setup([n({ id: "abc", title: "Unread one" })]);
    const menu = await openMenu();
    await userEvent.click(within(menu).getByText("Unread one"));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ ids: ["abc"] });
  });

  it("tapping an already-read notification does nothing", async () => {
    const calls = setup([n({ isRead: true, title: "Old one" })]);
    const menu = await openMenu();
    await userEvent.click(within(menu).getByText("Old one"));
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  describe("friend requests", () => {
    const request = n({ id: "fr1", type: "FRIEND_ADDED", title: "New friend request", data: { userId: "u9", pending: true } });

    it("shows Accept / Decline only for pending requests", async () => {
      setup([request, n({ id: "fr2", type: "FRIEND_ADDED", title: "Friend request accepted", data: { userId: "u8", accepted: true } })]);
      const menu = await openMenu();
      expect(within(menu).getAllByRole("button", { name: /accept/i })).toHaveLength(1);
      expect(within(menu).getAllByRole("button", { name: /decline/i })).toHaveLength(1);
    });

    it("Accept sends the requester id and confirms", async () => {
      const calls = setup([request], (url, init) => (init?.method === "POST" ? { data: { accepted: true } } : undefined));
      const menu = await openMenu();
      await userEvent.click(within(menu).getByRole("button", { name: /accept/i }));
      await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ action: "accept", requesterId: "u9" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it("Decline sends the right action", async () => {
      const calls = setup([request], (url, init) => (init?.method === "POST" ? { data: { declined: true } } : undefined));
      const menu = await openMenu();
      await userEvent.click(within(menu).getByRole("button", { name: /decline/i }));
      await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ action: "decline", requesterId: "u9" }));
    });

    it("a failed response restores the buttons and shows the error", async () => {
      setup([request], (url, init) => (init?.method === "POST" ? { error: { message: "Request not found" } } : undefined));
      const menu = await openMenu();
      await userEvent.click(within(menu).getByRole("button", { name: /accept/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Request not found"));
      expect(within(menu).getByRole("button", { name: /accept/i })).toBeInTheDocument();
    });

    it("clicking Accept doesn't also mark the notification read (event isn't double-handled)", async () => {
      const calls = setup([request], (url, init) => (init?.method === "POST" ? { data: {} } : undefined));
      const menu = await openMenu();
      await userEvent.click(within(menu).getByRole("button", { name: /accept/i }));
      await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
      expect(calls.filter((c) => c.method === "PATCH" && (c.body as { ids?: string[] })?.ids)).toHaveLength(0);
    });
  });
});
