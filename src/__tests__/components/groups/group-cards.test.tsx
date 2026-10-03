import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GroupStats } from "@/lib/group-stats";

const useGroupDebts = vi.fn();
vi.mock("@/hooks/use-settlements", () => ({ useGroupDebts: (id: string) => useGroupDebts(id) }));

import { GroupStatsCard } from "@/components/groups/group-stats-card";
import { GroupDebtsCard } from "@/components/groups/group-debts-card";

const names = { me: "Me", a: "Asha", b: "Bhanu" };
const stats: GroupStats = {
  currency: "INR", approximate: false, rateDate: "", total: 250000, yourShare: 100000, yourPaid: 150000, expenseCount: 3,
  byCategory: [{ category: "FOOD", total: 150000 }, { category: "TRAVEL", total: 100000 }],
  byMember: [{ userId: "me", paid: 150000, share: 100000 }, { userId: "a", paid: 100000, share: 150000 }],
  otherCurrencies: [{ currency: "USD", total: 5000 }],
};

describe("GroupStatsCard", () => {
  it("renders nothing for a group with no expenses", () => {
    const { container } = render(<GroupStatsCard names={names} stats={{ ...stats, expenseCount: 0 }} />);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<GroupStatsCard names={names} />);
    expect(c2).toBeEmptyDOMElement();
  });

  it("shows totals in rupee lakh/K format, categories and top payers", () => {
    render(<GroupStatsCard names={names} stats={stats} currentUserId="me" />);
    expect(screen.getByText("Total spent")).toBeInTheDocument();
    expect(screen.getByText("₹2.5K")).toBeInTheDocument(); // 250000 paise = ₹2,500
    expect(screen.getByText("food")).toBeInTheDocument();
    expect(screen.getByText(/You \(₹1.5K\)/)).toBeInTheDocument();
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
  });

  it("says which spending could NOT be converted (no rate) instead of dropping or mis-adding it", () => {
    render(<GroupStatsCard names={names} stats={stats} />);
    expect(screen.getByTestId("stats-skipped")).toHaveTextContent(/no exchange rate/i);
    expect(screen.getByTestId("stats-skipped")).toHaveTextContent("$50.00");
    expect(screen.queryByTestId("stats-converted")).not.toBeInTheDocument();
  });

  it("marks figures that include converted spending as approximate, with the rate date", () => {
    render(<GroupStatsCard names={names} stats={{ ...stats, otherCurrencies: [], approximate: true, rateDate: "2026-10-02" }} />);
    expect(screen.getByTestId("stats-converted")).toHaveTextContent("≈");
    expect(screen.getByTestId("stats-converted")).toHaveTextContent("INR");
    expect(screen.getByTestId("stats-converted")).toHaveTextContent("2026-10-02");
    expect(screen.queryByTestId("stats-skipped")).not.toBeInTheDocument();
  });

  it("shows neither note when everything is in one currency", () => {
    render(<GroupStatsCard names={names} stats={{ ...stats, otherCurrencies: [] }} />);
    expect(screen.queryByTestId("stats-converted")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stats-skipped")).not.toBeInTheDocument();
  });
});

describe("GroupDebtsCard", () => {
  beforeEach(() => useGroupDebts.mockReset());

  it("shows a settled message when there are no debts", () => {
    useGroupDebts.mockReturnValue({ data: { simplified: [] }, isLoading: false });
    render(<GroupDebtsCard groupId="g" names={names} currentUserId="me" onPay={vi.fn()} />);
    expect(screen.getByText(/settled up/i)).toBeInTheDocument();
  });

  it("lists every payment, names the current user as You, and offers Pay only on my own debts", async () => {
    const onPay = vi.fn();
    useGroupDebts.mockReturnValue({
      isLoading: false,
      data: { simplified: [
        { fromUserId: "me", toUserId: "a", amount: 50000, currency: "INR" },
        { fromUserId: "b", toUserId: "a", amount: 20000, currency: "INR" },
      ] },
    });
    render(<GroupDebtsCard groupId="g" names={names} currentUserId="me" onPay={onPay} />);
    expect(screen.getByText(/2 payments settle the whole group/i)).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Bhanu")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();

    const payButtons = screen.getAllByRole("button", { name: "Pay" });
    expect(payButtons).toHaveLength(1); // Bhanu's debt is not mine to pay
    await userEvent.click(payButtons[0]);
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ fromUserId: "me", toUserId: "a", amount: 50000 }));
  });

  it("offers one-tap UPI only on my own rupee debts to someone who saved a UPI ID", () => {
    useGroupDebts.mockReturnValue({
      isLoading: false,
      data: { simplified: [
        { fromUserId: "me", toUserId: "a", amount: 50000, currency: "INR" },
        { fromUserId: "me", toUserId: "b", amount: 20000, currency: "INR" },
        { fromUserId: "b", toUserId: "a", amount: 10000, currency: "INR" },
      ] },
    });
    render(<GroupDebtsCard groupId="g" names={names} currentUserId="me" upiIds={{ a: "asha@ybl" }} onPay={vi.fn()} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1); // not for Bhanu (no UPI id) and not for Bhanu→Asha (not my debt)
    expect(links[0].getAttribute("href")).toContain("pa=asha%40ybl");
    expect(links[0].getAttribute("href")).toContain("am=500.00");
  });

  it("doesn't offer UPI for non-rupee debts", () => {
    useGroupDebts.mockReturnValue({ isLoading: false, data: { simplified: [{ fromUserId: "me", toUserId: "a", amount: 5000, currency: "USD" }] } });
    render(<GroupDebtsCard groupId="g" names={names} currentUserId="me" upiIds={{ a: "asha@ybl" }} onPay={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
