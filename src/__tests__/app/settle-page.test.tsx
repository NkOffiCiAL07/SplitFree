import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  settlements: { data: [] as unknown[], isLoading: false },
  balance: { data: { simplified: [] as unknown[] }, isLoading: false },
  friends: { data: [] as unknown[] },
  settleUp: vi.fn(), remind: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => "INR", useProfile: () => ({ data: { upiId: "nishant@okaxis" } }) }));
vi.mock("@/hooks/use-friends", () => ({ useFriendContacts: () => h.friends }));
vi.mock("@/hooks/use-settlements", () => ({
  useSettlements: () => h.settlements,
  useBalance: () => h.balance,
  useSettleUp: () => ({ mutateAsync: h.settleUp, isPending: false }),
  useSendReminder: () => ({ mutate: h.remind, isPending: false }),
}));

import SettlePage from "@/app/(dashboard)/settle/page";

const person = (id: string, name: string, upiId: string | null = null) => ({ id, name, avatarUrl: null, upiId });
const debt = (over: object) => ({ fromUserId: "me", toUserId: "a", amount: 50000, currency: "INR", fromUser: person("me", "Nishant"), toUser: person("a", "Asha Rao", "asha@okhdfc"), ...over });

beforeEach(() => {
  vi.clearAllMocks();
  h.settleUp.mockResolvedValue({});
  h.settlements.data = []; h.settlements.isLoading = false;
  h.balance.data = { simplified: [] }; h.balance.isLoading = false;
  h.friends.data = [{ friendId: "a", friend: { name: "Asha Rao" } }, { friendId: "b", friend: { name: "Bhanu Pal" } }];
});

describe("SettlePage — what you owe and are owed", () => {
  it("celebrates when everything is settled", () => {
    render(<SettlePage />);
    expect(screen.getByText("All settled up!")).toBeInTheDocument();
  });

  it("lists each simplified payment, with You on your own side", () => {
    h.balance.data = { simplified: [debt({}), debt({ fromUserId: "b", toUserId: "me", amount: 20000, fromUser: person("b", "Bhanu Pal"), toUser: person("me", "Nishant") })] };
    render(<SettlePage />);
    expect(screen.getByText("₹500.00", { selector: "span.font-bold" })).toBeInTheDocument();
    expect(screen.getByText("₹200.00", { selector: "span.font-bold" })).toBeInTheDocument();
    expect(screen.getAllByText("You")).toHaveLength(2);
  });

  it("summarises totals per currency without adding currencies together", () => {
    h.balance.data = { simplified: [debt({ amount: 50000 }), debt({ toUserId: "c", amount: 10000, currency: "USD", toUser: person("c", "Chris") })] };
    render(<SettlePage />);
    expect(screen.getByText("₹500.00 + $100.00")).toBeInTheDocument();
  });

  it("offers Pay + one-tap UPI on my rupee debts, and Remind on debts owed to me", () => {
    h.balance.data = { simplified: [debt({}), debt({ fromUserId: "b", toUserId: "me", amount: 20000, fromUser: person("b", "Bhanu Pal"), toUser: person("me", "Nishant") })] };
    render(<SettlePage />);
    expect(screen.getAllByRole("button", { name: "Pay" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Remind" })).toHaveLength(1);
    const upi = screen.getByRole("link", { name: /pay asha rao via upi/i });
    expect(upi.getAttribute("href")).toContain("pa=asha%40okhdfc");
    expect(upi.getAttribute("href")).toContain("am=500.00");
  });

  it("no UPI button for dollar debts or payees without a saved UPI ID", () => {
    h.balance.data = { simplified: [debt({ currency: "USD" }), debt({ toUserId: "c", toUser: person("c", "Chris", null) })] };
    render(<SettlePage />);
    expect(screen.queryByRole("link", { name: /via upi/i })).not.toBeInTheDocument();
  });

  it("Remind sends the debtor, amount and currency", async () => {
    h.balance.data = { simplified: [debt({ fromUserId: "b", toUserId: "me", amount: 20000, currency: "INR", fromUser: person("b", "Bhanu Pal"), toUser: person("me", "Nishant") })] };
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: "Remind" }));
    expect(h.remind).toHaveBeenCalledWith({ debtorId: "b", amount: 20000, currency: "INR" });
  });

  it("Remind on WhatsApp opens a ready-to-send message with the amount and my UPI ID", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    h.balance.data = { simplified: [debt({ fromUserId: "b", toUserId: "me", amount: 20000, currency: "INR", fromUser: person("b", "Bhanu Pal"), toUser: person("me", "Nishant") })] };
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /remind bhanu pal on whatsapp/i }));
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://wa.me/");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Hi Bhanu");
    expect(text).toContain("₹200.00");
    expect(text).toContain("nishant@okaxis");
    expect(open.mock.calls[0][1]).toBe("_blank");
    expect(h.remind).not.toHaveBeenCalled(); // WhatsApp is separate from the in-app reminder
  });

  it("no WhatsApp reminder on debts I owe", () => {
    h.balance.data = { simplified: [debt({})] };
    render(<SettlePage />);
    expect(screen.queryByRole("button", { name: /on whatsapp/i })).not.toBeInTheDocument();
  });

  it("shares the plan via the clipboard when the share sheet isn't available", async () => {
    h.balance.data = { simplified: [debt({})] };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /share plan/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toMatch(/You → Asha Rao: ₹500\.00/);
    expect(h.toast.success).toHaveBeenCalledWith("Settle plan copied");
  });

  it("uses the native share sheet when available", async () => {
    h.balance.data = { simplified: [debt({})] };
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /share plan/i }));
    expect(share).toHaveBeenCalledWith({ text: expect.stringContaining("settle plan") });
  });
});

describe("SettlePage — recording a payment", () => {
  it("Pay opens the dialog prefilled with that debt's person, amount and currency", async () => {
    h.balance.data = { simplified: [debt({ currency: "USD", amount: 12550 })] };
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue("125.50")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/currency/i)).toHaveValue("USD");
    expect(within(dialog).getByLabelText(/currency/i)).toBeDisabled(); // tied to the debt
    await userEvent.click(within(dialog).getByRole("button", { name: /record payment/i }));
    await waitFor(() => expect(h.settleUp).toHaveBeenCalled());
    expect(h.settleUp.mock.calls[0][0]).toMatchObject({ toUserId: "a", amount: 125.5, currency: "USD" });
  });

  it("a manual payment needs a person and amount, defaults to INR, and lets you pick a currency", async () => {
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: /record payment/i });
    expect(submit).toBeDisabled();
    expect(within(dialog).getByLabelText(/currency/i)).toHaveValue("INR");
    await userEvent.click(within(dialog).getByRole("button", { name: /bhanu/i }));
    await userEvent.type(within(dialog).getByPlaceholderText("0.00"), "250");
    await userEvent.selectOptions(within(dialog).getByLabelText(/currency/i), "EUR");
    await userEvent.type(within(dialog).getByPlaceholderText(/upi, cash/i), "cash");
    await userEvent.click(submit);
    await waitFor(() => expect(h.settleUp).toHaveBeenCalled());
    expect(h.settleUp.mock.calls[0][0]).toEqual({ toUserId: "b", amount: 250, currency: "EUR", note: "cash" });
  });

  it("INR payments show a UPI section that builds a pay link for the typed ID and amount", async () => {
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /asha/i }));
    await userEvent.type(within(dialog).getByPlaceholderText("0.00"), "99.50");
    expect(within(dialog).queryByRole("link", { name: /pay in upi app/i })).not.toBeInTheDocument(); // no ID yet
    await userEvent.type(within(dialog).getByPlaceholderText("name@bank"), "asha@ybl");
    const link = within(dialog).getByRole("link", { name: /pay in upi app/i });
    expect(link.getAttribute("href")).toContain("pa=asha%40ybl");
    expect(link.getAttribute("href")).toContain("am=99.50");
    await userEvent.selectOptions(within(dialog).getByLabelText(/currency/i), "USD");
    expect(within(dialog).queryByPlaceholderText("name@bank")).not.toBeInTheDocument(); // UPI is rupee-only
  });

  it("with no friends, explains how to add some", async () => {
    h.friends.data = [];
    render(<SettlePage />);
    await userEvent.click(screen.getByRole("button", { name: /record payment/i }));
    expect(await screen.findByText(/no friends yet/i)).toBeInTheDocument();
  });
});

describe("SettlePage — history", () => {
  it("shows the empty state, or the payments", () => {
    const { unmount } = render(<SettlePage />);
    expect(screen.getByText("No payments recorded yet")).toBeInTheDocument();
    unmount();
    h.settlements.data = [{ id: "s1", fromUserId: "me", toUserId: "a", amount: 30000, currency: "INR", note: "UPI", createdAt: "2026-03-01", fromUser: person("me", "Nishant"), toUser: person("a", "Asha Rao") }];
    render(<SettlePage />);
    expect(screen.queryByText("No payments recorded yet")).not.toBeInTheDocument();
    expect(screen.getByText(/₹300\.00/)).toBeInTheDocument();
  });

  it("shows each past payment in ITS OWN currency (regression: they all used the profile currency)", () => {
    h.settlements.data = [
      { id: "s1", fromUserId: "me", toUserId: "a", amount: 5000, currency: "USD", note: null, createdAt: "2026-03-01", fromUser: person("me", "Nishant"), toUser: person("a", "Asha Rao") },
      { id: "s2", fromUserId: "a", toUserId: "me", amount: 5000, currency: "INR", note: null, createdAt: "2026-03-02", fromUser: person("a", "Asha Rao"), toUser: person("me", "Nishant") },
    ];
    render(<SettlePage />);
    // direction is shown by colour (red = you paid out, green = you received), never by a +/− sign
    expect(screen.getByText("$50.00")).toHaveClass("text-red-700");
    expect(screen.getByText("₹50.00")).toHaveClass("text-green-700");
    expect(screen.queryByText(/[−+-]\s?[$₹]/)).not.toBeInTheDocument();
  });
});
