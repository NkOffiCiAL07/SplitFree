import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useExpenseHistory = vi.fn();
vi.mock("@/hooks/use-expenses", () => ({ useExpenseHistory: (id: string, enabled: boolean) => useExpenseHistory(id, enabled) }));

import { ExpenseHistory } from "@/components/expenses/expense-history";

beforeEach(() => useExpenseHistory.mockReset());

const data = {
  currency: "INR",
  people: { a: "Asha", b: "Bhanu" },
  revisions: [
    { id: "r1", editorId: "b", createdAt: new Date().toISOString(), changes: {
      amount: { from: 50000, to: 65000 },
      description: { from: "Dinner", to: "Dinner at Taj" },
      paidBy: { from: "a", to: "b" },
    } },
  ],
};

describe("ExpenseHistory", () => {
  it("is collapsed by default and does not load until opened", () => {
    useExpenseHistory.mockReturnValue({ isLoading: false, data: undefined });
    render(<ExpenseHistory expenseId="e1" />);
    expect(useExpenseHistory).toHaveBeenCalledWith("e1", false);
    expect(screen.queryByText(/no edits yet/i)).not.toBeInTheDocument();
  });

  it("loads when opened and shows who changed what, in readable form", async () => {
    useExpenseHistory.mockReturnValue({ isLoading: false, data });
    render(<ExpenseHistory expenseId="e1" />);
    await userEvent.click(screen.getByRole("button", { name: /edit history/i }));
    expect(useExpenseHistory).toHaveBeenLastCalledWith("e1", true);
    expect(screen.getByText("Bhanu")).toBeInTheDocument();
    expect(screen.getByText("Amount: ₹500.00 → ₹650.00")).toBeInTheDocument();
    expect(screen.getByText("Description: Dinner → Dinner at Taj")).toBeInTheDocument();
    expect(screen.getByText("Paid by: Asha → Bhanu")).toBeInTheDocument();
  });

  it("says so when the expense was never edited", async () => {
    useExpenseHistory.mockReturnValue({ isLoading: false, data: { currency: "INR", people: {}, revisions: [] } });
    render(<ExpenseHistory expenseId="e1" />);
    await userEvent.click(screen.getByRole("button", { name: /edit history/i }));
    expect(screen.getByText(/no edits yet/i)).toBeInTheDocument();
  });

  it("shows loading and error states", async () => {
    useExpenseHistory.mockReturnValue({ isLoading: true });
    const { unmount } = render(<ExpenseHistory expenseId="e1" />);
    await userEvent.click(screen.getByRole("button", { name: /edit history/i }));
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    unmount();
    useExpenseHistory.mockReturnValue({ isLoading: false, error: new Error("x") });
    render(<ExpenseHistory expenseId="e1" />);
    await userEvent.click(screen.getByRole("button", { name: /edit history/i }));
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    useExpenseHistory.mockReturnValue({ isLoading: false, data });
    render(<ExpenseHistory expenseId="e1" />);
    const btn = screen.getByRole("button", { name: /edit history/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText("Bhanu")).not.toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });
});
