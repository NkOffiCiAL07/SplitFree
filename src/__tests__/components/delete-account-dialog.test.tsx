import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ signOut: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { email: "Me@Example.com" }, signOut: h.signOut }) }));

import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

const open = async () => {
  render(<DeleteAccountDialog />);
  await userEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
  return screen.findByRole("dialog");
};
const type = (dialog: HTMLElement, value: string) => userEvent.type(within(dialog).getByLabelText(/type your email/i), value);
const confirmBtn = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: /delete my account/i });

let loc: { href: string };
beforeEach(() => {
  vi.clearAllMocks();
  loc = { href: "" };
  vi.stubGlobal("location", loc);
  h.signOut.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("DeleteAccountDialog", () => {
  it("explains exactly what will happen before anything can be done", async () => {
    const dialog = await open();
    expect(dialog).toHaveTextContent(/can't be undone/i);
    expect(dialog).toHaveTextContent(/name, email, photo, UPI ID, comments and notifications are erased/i);
    expect(dialog).toHaveTextContent(/Deleted user/);
    expect(dialog).toHaveTextContent(/settled up with everyone/i);
    expect(dialog).toHaveTextContent(/download your data first/i);
  });

  it("the delete button stays disabled until the exact email is typed (any case)", async () => {
    const dialog = await open();
    expect(confirmBtn(dialog)).toBeDisabled();
    await type(dialog, "someone@else.com");
    expect(confirmBtn(dialog)).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText(/type your email/i));
    await type(dialog, "  me@example.COM ");
    expect(confirmBtn(dialog)).toBeEnabled();
  });

  it("on success: sends the confirmation, signs out and leaves for the landing page", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { deleted: true } }) });
    vi.stubGlobal("fetch", f);
    const dialog = await open();
    await type(dialog, "me@example.com");
    await userEvent.click(confirmBtn(dialog));
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith("/api/account", expect.objectContaining({ method: "DELETE" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ confirmEmail: "me@example.com" });
    expect(h.toast.success).toHaveBeenCalledWith("Your account has been deleted");
    expect(loc.href).toBe("/");
  });

  it("with balances left: lists who to settle with (green/red words, no signs), and does NOT sign out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ error: { message: "Settle up first" }, blockers: [{ userId: "a1", name: "Asha", currency: "INR", net: 50000 }, { userId: "b1", name: "Bhanu", currency: "USD", net: -2000 }] }),
    }));
    const dialog = await open();
    await type(dialog, "me@example.com");
    await userEvent.click(confirmBtn(dialog));
    const list = await screen.findByTestId("delete-blockers");
    expect(within(list).getByRole("link", { name: "Asha" })).toHaveAttribute("href", "/friends/a1");
    expect(within(list).getByText("owes you ₹500.00")).toHaveClass("text-green-700");
    expect(within(list).getByText("you owe $20.00")).toHaveClass("text-red-700");
    expect(list.textContent).not.toMatch(/[−+]\s?[$₹]/);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(loc.href).toBe("");
  });

  it("shows the server's message for other failures and stays signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: { message: "We couldn't finish closing the account" } }) }));
    const dialog = await open();
    await type(dialog, "me@example.com");
    await userEvent.click(confirmBtn(dialog));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("We couldn't finish closing the account"));
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("offline: says it needs a connection, changes nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const dialog = await open();
    await type(dialog, "me@example.com");
    await userEvent.click(confirmBtn(dialog));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/offline/i)));
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("Cancel closes it and forgets what was typed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const dialog = await open();
    await type(dialog, "me@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    expect(within(await screen.findByRole("dialog")).getByLabelText(/type your email/i)).toHaveValue("");
    expect(fetch).not.toHaveBeenCalled();
  });
});
