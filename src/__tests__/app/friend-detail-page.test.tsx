import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useFriendDetail = vi.fn();
vi.mock("@/hooks/use-friends", () => ({ useFriendDetail: (id: string) => useFriendDetail(id) }));
const settleMutateAsync = vi.fn().mockResolvedValue({});
const remindMutate = vi.fn();
vi.mock("@/hooks/use-settlements", () => ({
  useSettleUp: () => ({ mutateAsync: settleMutateAsync, isPending: false }),
  useSendReminder: () => ({ mutate: remindMutate, isPending: false }),
}));

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { upiId: "nishant@okaxis" } }) }));

import FriendDetailPage from "@/app/(dashboard)/friends/[id]/page";

const FRIEND = { id: "f1", name: "Asha Rao", email: "asha@example.com", avatarUrl: null };
const detail = (over = {}) => ({
  friend: FRIEND, balances: [], expenses: [], settlements: [], ...over,
});

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <FriendDetailPage params={Promise.resolve({ id: "f1" })} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  settleMutateAsync.mockResolvedValue({});
});

describe("FriendDetailPage", () => {
  it("shows a loading skeleton, then an error with a way back", async () => {
    useFriendDetail.mockReturnValue({ isLoading: true });
    await renderPage();
    expect(screen.queryByText("Asha Rao")).not.toBeInTheDocument();
  });

  it("explains failures and links back to Friends", async () => {
    useFriendDetail.mockReturnValue({ isLoading: false, error: new Error("Person not found") });
    await renderPage();
    expect(screen.getByText("Person not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to friends/i })).toHaveAttribute("href", "/friends");
  });

  it("says you're settled when there are no balances", async () => {
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail() });
    await renderPage();
    expect(screen.getByText(/all settled up with Asha/i)).toBeInTheDocument();
    expect(screen.getByText(/no shared expenses yet/i)).toBeInTheDocument();
  });

  it("when they owe you: shows the amount in rupees and offers Remind", async () => {
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail({ balances: [{ currency: "INR", net: 123456 }] }) });
    await renderPage();
    expect(screen.getByText("Asha owes you ₹1,234.56")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remind" }));
    expect(remindMutate).toHaveBeenCalledWith({ debtorId: "f1", amount: 123456, currency: "INR" });
    expect(screen.queryByRole("button", { name: /settle up/i })).not.toBeInTheDocument();
  });

  it("when they owe you: Remind on WhatsApp opens a message with the amount and your UPI ID", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail({ balances: [{ currency: "INR", net: 123456 }] }) });
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /remind asha rao on whatsapp/i }));
    const text = new URL(open.mock.calls[0][0] as string).searchParams.get("text")!;
    expect(text).toContain("Hi Asha");
    expect(text).toContain("₹1,234.56");
    expect(text).toContain("nishant@okaxis");
  });

  it("dollar debts get a WhatsApp reminder without a UPI line (UPI is rupees only)", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail({ balances: [{ currency: "USD", net: 2500 }] }) });
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /on whatsapp/i }));
    const text = new URL(open.mock.calls[0][0] as string).searchParams.get("text")!;
    expect(text).toContain("$25.00");
    expect(text).not.toMatch(/UPI/);
  });

  it("when you owe them: settling needs a confirmation and pays in that currency", async () => {
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail({ balances: [{ currency: "USD", net: -2500 }] }) });
    await renderPage();
    expect(screen.getByText("You owe Asha $25.00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /settle up/i }));
    expect(settleMutateAsync).not.toHaveBeenCalled(); // first tap only asks to confirm
    await userEvent.click(screen.getByRole("button", { name: /confirm \$25\.00/i }));
    expect(settleMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ toUserId: "f1", amount: 25, currency: "USD" }));
  });

  it("can cancel the confirmation without paying", async () => {
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail({ balances: [{ currency: "INR", net: -500 }] }) });
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /settle up/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(settleMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /settle up/i })).toBeInTheDocument();
  });

  it("lists shared expenses with who paid and the signed amount owed", async () => {
    useFriendDetail.mockReturnValue({
      isLoading: false,
      data: detail({
        balances: [{ currency: "INR", net: 300 }],
        expenses: [
          { id: "e1", description: "Dinner", amount: 1000, currency: "INR", category: "FOOD", date: "2026-03-01", paidById: "me",
            group: { id: "g", name: "Goa Trip" }, delta: 500, multiplePayers: false },
          { id: "e2", description: "Cab", amount: 400, currency: "INR", category: "TRANSPORT", date: "2026-03-02", paidById: "f1",
            group: null, delta: -200, multiplePayers: false },
          { id: "e3", description: "Hotel", amount: 9000, currency: "INR", category: "TRAVEL", date: "2026-03-03", paidById: "me",
            group: null, delta: 1500, multiplePayers: true },
        ],
        settlements: [{ id: "s1", fromUserId: "f1", toUserId: "me", amount: 200, currency: "INR", note: "UPI", createdAt: "2026-03-03" }],
      }),
    });
    await renderPage();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText(/You paid ₹10\.00 · Goa Trip/)).toBeInTheDocument();
    expect(screen.getByText("you lent ₹5.00")).toHaveClass("text-green-700"); // Asha owes me her ₹5 share
    expect(screen.getByText(/Asha paid ₹4\.00/)).toBeInTheDocument();
    expect(screen.getByText("you owe ₹2.00")).toHaveClass("text-red-700"); // I owe Asha my ₹2 share
    expect(screen.getByText(/Paid by several ₹90\.00/)).toBeInTheDocument(); // multi-payer expense
    expect(screen.getByText("you lent ₹15.00")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[−+]\s?₹/); // no +/− signs on money anywhere
    expect(screen.getByText(/Asha paid you/)).toBeInTheDocument();
  });

  it("when you owe them rupees and they saved a UPI ID: offers one-tap UPI with the exact amount", async () => {
    useFriendDetail.mockReturnValue({
      isLoading: false,
      data: detail({ friend: { ...FRIEND, upiId: "asha@okhdfc" }, balances: [{ currency: "INR", net: -250050 }] }),
    });
    await renderPage();
    const link = screen.getByRole("link", { name: /pay asha rao via upi/i });
    expect(link.getAttribute("href")).toContain("am=2500.50");
    expect(link.getAttribute("href")).toContain("pa=asha%40okhdfc");
  });

  it.each([
    ["they owe you", { friend: { ...FRIEND, upiId: "asha@okhdfc" }, balances: [{ currency: "INR", net: 500 }] }],
    ["they have no saved UPI ID", { friend: { ...FRIEND, upiId: null }, balances: [{ currency: "INR", net: -500 }] }],
    ["the debt is in another currency", { friend: { ...FRIEND, upiId: "asha@okhdfc" }, balances: [{ currency: "USD", net: -500 }] }],
  ])("no UPI button when %s", async (_label, over) => {
    useFriendDetail.mockReturnValue({ isLoading: false, data: detail(over) });
    await renderPage();
    expect(screen.queryByRole("link", { name: /via upi/i })).not.toBeInTheDocument();
  });
});
