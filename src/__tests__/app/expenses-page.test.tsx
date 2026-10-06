import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useInfiniteExpenses } = vi.hoisted(() => ({ useInfiniteExpenses: vi.fn() }));
vi.mock("@/hooks/use-expenses", () => ({
  useInfiniteExpenses: (f: unknown) => useInfiniteExpenses(f),
  useDeleteExpense: () => ({ mutate: vi.fn() }),
  useDuplicateExpense: () => ({ mutate: vi.fn() }),
}));
vi.mock("usehooks-ts", () => ({ useDebounceValue: (v: unknown) => [v] })); // no waiting in tests
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => "INR" }));
vi.mock("@/components/expenses/lazy-add-expense-dialog", () => ({ LazyAddExpenseDialog: ({ open }: { open?: boolean }) => (open ? <div data-testid="add-dialog" /> : null) }));
vi.mock("@/components/expenses/expense-comments", () => ({ ExpenseComments: () => <div /> }));
vi.mock("@/components/expenses/expense-history", () => ({ ExpenseHistory: () => <div /> }));
vi.mock("@/components/expenses/reaction-bar", async (orig) => ({ ...(await orig<typeof import("@/components/expenses/reaction-bar")>()), ReactionBar: ({ expenseId }: { expenseId: string }) => <div data-testid="reaction-bar-stub" data-expense={expenseId} /> })); // (the real bar needs a QueryClient; the chips on rows are real)
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import ExpensesPage from "@/app/(dashboard)/expenses/page";

const exp = (id: string) => ({
  id, description: `Expense ${id}`, amount: 10000, currency: "INR", category: "FOOD", date: "2026-03-01", paidById: "me",
  paidBy: { name: "Me" }, isRecurring: false, splits: [{ userId: "me", amount: 10000 }], payers: [],
});

const state = (over = {}) => ({
  expenses: [exp("1"), exp("2")], isLoading: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), ...over,
});

beforeEach(() => useInfiniteExpenses.mockReset());

describe("ExpensesPage — app-icon shortcut", () => {
  it("opens the add-expense form when launched from the 'Add Expense' app shortcut (?action=new), and cleans the address", async () => {
    const nav = await import("next/navigation");
    const spy = vi.spyOn(nav, "useSearchParams").mockReturnValue(new URLSearchParams("action=new") as never);
    const replace = vi.spyOn(window.history, "replaceState");
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    expect(screen.getByTestId("add-dialog")).toBeInTheDocument(); // the form is open
    expect(replace).toHaveBeenCalledWith(null, "", window.location.pathname);
    spy.mockRestore();
  });

  it("does nothing special for a normal visit", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    expect(screen.queryByTestId("add-dialog")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("ExpensesPage — mixed currencies", () => {
  const usd = { ...exp("9"), description: "Hotel", currency: "USD", amount: 20000, group: { name: "Goa", currency: "INR" }, splits: [{ userId: "me", amount: 10000, user: { name: "Me" } }, { userId: "a", amount: 10000, user: { name: "Asha" } }] };

  it("every row shows its OWN currency, even when the group's currency differs", () => {
    useInfiniteExpenses.mockReturnValue(state({ expenses: [exp("1"), usd] }));
    render(<ExpensesPage />);
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByText("₹100.00")).toBeInTheDocument();
  });

  it("the details dialog shows the total AND each person's split in the expense's currency (not the group's)", async () => {
    useInfiniteExpenses.mockReturnValue(state({ expenses: [usd] }));
    render(<ExpensesPage />);
    await userEvent.click(screen.getByText("Hotel"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("$200.00");
    expect(dialog).toHaveTextContent("$100.00"); // Asha's split — used to print ₹100.00 (the group's currency)
    expect(dialog).not.toHaveTextContent("₹");
  });
});

describe("ExpensesPage — full history", () => {
  it("shows the expenses with an exact count when everything is loaded", () => {
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    expect(screen.getByText("Expense 1")).toBeInTheDocument();
    expect(screen.getByText("2 expenses")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("offers Load more when there is another page, and fetches it", async () => {
    const fetchNextPage = vi.fn();
    useInfiniteExpenses.mockReturnValue(state({ hasNextPage: true, fetchNextPage }));
    render(<ExpensesPage />);
    expect(screen.getByText("2+ expenses")).toBeInTheDocument(); // "+" = there are more than shown
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("sends search text to the server (so it covers the whole history, not just what's loaded)", async () => {
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    expect(useInfiniteExpenses).toHaveBeenLastCalledWith({ q: "", category: "ALL", from: "", to: "" });
    await userEvent.type(screen.getByPlaceholderText(/search expenses/i), "goa");
    expect(useInfiniteExpenses).toHaveBeenLastCalledWith({ q: "goa", category: "ALL", from: "", to: "" });
    expect(screen.getByText("2 matching expenses")).toBeInTheDocument();
  });

  it("distinguishes 'no expenses yet' from 'no results for these filters'", async () => {
    useInfiniteExpenses.mockReturnValue(state({ expenses: [] }));
    render(<ExpensesPage />);
    expect(screen.getByText("No expenses yet")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/search expenses/i), "zzz");
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    useInfiniteExpenses.mockReturnValue(state({ expenses: [], isLoading: true }));
    render(<ExpensesPage />);
    expect(screen.queryByText("No expenses yet")).not.toBeInTheDocument();
  });
});

describe("ExpensesPage — emoji reactions", () => {
  it("each row shows its reactions as small chips; rows without any show none", () => {
    useInfiniteExpenses.mockReturnValue(state({ expenses: [{ ...exp("1"), reactions: [{ emoji: "🍕", count: 2, mine: true }] }, exp("2")] }));
    render(<ExpensesPage />);
    const chips = screen.getAllByTestId("reaction-chips");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("🍕2");
  });

  it("opening an expense shows the reaction bar for THAT expense", async () => {
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    await userEvent.click(screen.getByText("Expense 2"));
    expect(await screen.findByTestId("reaction-bar-stub")).toHaveAttribute("data-expense", "2");
  });
});


describe("ExpensesPage — date filter", () => {
  it("the two date boxes are labelled From and To, so an empty one never looks like a chosen date", () => {
    useInfiniteExpenses.mockReturnValue(state());
    render(<ExpensesPage />);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
    const inputs = document.querySelectorAll("input[type=date]");
    expect(inputs).toHaveLength(2);
    for (const i of inputs) expect(i.className).toContain("text-muted-foreground"); // empty = muted
  });
});
