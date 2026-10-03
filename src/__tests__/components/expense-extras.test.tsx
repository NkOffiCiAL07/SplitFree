import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  update: vi.fn(),
  comments: { data: [] as unknown[] | undefined, isLoading: false },
  addComment: vi.fn(), deleteComment: vi.fn(),
  budget: { data: undefined as unknown },
  setBudget: vi.fn(), deleteBudget: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-expenses", () => ({ useUpdateExpense: () => ({ mutateAsync: h.update, isPending: false }) }));
vi.mock("@/hooks/use-comments", () => ({
  useComments: () => h.comments,
  useAddComment: () => ({ mutateAsync: h.addComment, isPending: false }),
  useDeleteComment: () => ({ mutate: h.deleteComment }),
}));
vi.mock("@/hooks/use-budget", () => ({
  useGroupBudget: () => h.budget,
  useSetBudget: () => ({ mutateAsync: h.setBudget, isPending: false }),
  useDeleteBudget: () => ({ mutate: h.deleteBudget }),
}));

import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { ExpenseComments } from "@/components/expenses/expense-comments";
import { BudgetCard } from "@/components/groups/budget-card";
import type { Expense } from "@/types";

beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockResolvedValue({});
  h.addComment.mockResolvedValue({});
  h.setBudget.mockResolvedValue({});
  h.comments.data = []; h.comments.isLoading = false;
  h.budget.data = { budgets: [] };
});

const expense = (over: Partial<Expense> = {}) => ({
  id: "e1", groupId: "g1", description: "Dinner", amount: 30000, currency: "INR", category: "FOOD", splitType: "EQUAL",
  paidById: "me", paidBy: { name: "Nishant" }, date: "2026-03-01T00:00:00.000Z", isRecurring: false, recurringInterval: null, notes: null,
  splits: [{ userId: "me", amount: 15000, user: { name: "Nishant Kumar" } }, { userId: "a", amount: 15000, user: { name: "Asha Rao" } }],
  payers: [], ...over,
}) as unknown as Expense;

const renderEdit = (e: Expense) => render(<EditExpenseDialog expense={e} open onClose={vi.fn()} />);
const save = () => userEvent.click(screen.getByRole("button", { name: /save changes/i }));

describe("EditExpenseDialog", () => {
  it("is prefilled from the expense", async () => {
    renderEdit(expense({ notes: "birthday" }));
    expect(await screen.findByDisplayValue("Dinner")).toBeInTheDocument();
    expect(screen.getByDisplayValue("300.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("birthday")).toBeInTheDocument();
  });

  it("saves ordinary edits without touching payers", async () => {
    renderEdit(expense());
    const desc = await screen.findByDisplayValue("Dinner");
    await userEvent.clear(desc); await userEvent.type(desc, "Dinner at Taj");
    await save();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    const sent = h.update.mock.calls[0][0];
    expect(sent).toMatchObject({ id: "e1", description: "Dinner at Taj", amount: 300, category: "FOOD" });
    expect(sent).not.toHaveProperty("payers");
    expect(sent).not.toHaveProperty("paidById");
  });

  it("changing the single payer sends only paidById", async () => {
    renderEdit(expense());
    await screen.findByDisplayValue("Dinner");
    await userEvent.click(within(screen.getByTestId("payers-editor")).getByRole("button", { name: /asha/i }));
    await save();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0][0]).toMatchObject({ paidById: "a" });
    expect(h.update.mock.calls[0][0]).not.toHaveProperty("payers");
  });

  it("switching to multiple payers sends the amounts (and blocks wrong totals)", async () => {
    renderEdit(expense());
    await screen.findByDisplayValue("Dinner");
    await userEvent.click(screen.getByRole("button", { name: /multiple payers/i }));
    const you = screen.getByLabelText(/paid by you/i);
    const asha = screen.getByLabelText(/paid by asha/i);
    await userEvent.clear(you); await userEvent.type(you, "200");
    await userEvent.clear(asha); await userEvent.type(asha, "50");
    await save();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/less than the total/i));
    await userEvent.clear(asha); await userEvent.type(asha, "100");
    await save();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0][0].payers).toEqual([{ userId: "me", amount: 200 }, { userId: "a", amount: 100 }]);
  });

  it("shows the existing payers of a multi-payer expense, and going back to one payer clears them", async () => {
    renderEdit(expense({ payers: [{ userId: "me", amount: 20000 }, { userId: "a", amount: 10000 }] as never }));
    await screen.findByDisplayValue("Dinner");
    expect(screen.getByLabelText(/paid by you/i)).toHaveValue(200);
    expect(screen.getByLabelText(/paid by asha/i)).toHaveValue(100);
    await userEvent.click(screen.getByRole("button", { name: /multiple payers/i })); // back to single
    await userEvent.click(within(screen.getByTestId("payers-editor")).getByRole("button", { name: /asha/i }));
    await save();
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0][0]).toMatchObject({ payers: null, paidById: "a" });
  });

  it("requires a description and an amount", async () => {
    renderEdit(expense());
    await userEvent.clear(await screen.findByDisplayValue("Dinner"));
    await save();
    expect(h.update).not.toHaveBeenCalled();
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
  });

  it("hides the payer section for a personal expense with one person", async () => {
    renderEdit(expense({ splits: [{ userId: "me", amount: 30000, user: { name: "Nishant" } }] as never }));
    await screen.findByDisplayValue("Dinner");
    expect(screen.queryByTestId("payers-editor")).not.toBeInTheDocument();
  });
});

describe("ExpenseComments", () => {
  const comment = (over: object) => ({ id: "c1", userId: "a", text: "Looks right", createdAt: new Date().toISOString(), user: { name: "Asha Rao", avatarUrl: null }, ...over });

  it("shows skeletons while loading and an invitation when there are none", () => {
    h.comments.isLoading = true; h.comments.data = undefined;
    const { unmount } = render(<ExpenseComments expenseId="e1" />);
    expect(screen.queryByText(/no comments yet/i)).not.toBeInTheDocument();
    unmount();
    h.comments.isLoading = false; h.comments.data = [];
    render(<ExpenseComments expenseId="e1" />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("lists comments with the author's first name, and a count", () => {
    h.comments.data = [comment({}), comment({ id: "c2", text: "Thanks" })];
    render(<ExpenseComments expenseId="e1" />);
    expect(screen.getByText("Looks right")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getAllByText(/Asha ·/)).toHaveLength(2);
  });

  it("offers delete only on your own comments", async () => {
    h.comments.data = [comment({ id: "mine", userId: "me", text: "My note", user: { name: "Nishant" } }), comment({})];
    const { container } = render(<ExpenseComments expenseId="e1" />);
    const deletes = container.querySelectorAll("button.opacity-0");
    expect(deletes).toHaveLength(1);
    await userEvent.click(deletes[0]);
    expect(h.deleteComment).toHaveBeenCalledWith("mine");
  });

  it("posts a trimmed comment, clears the box, and ignores blank input", async () => {
    render(<ExpenseComments expenseId="e1" />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "   {Enter}");
    expect(h.addComment).not.toHaveBeenCalled();
    await userEvent.type(input, "  great  {Enter}");
    await waitFor(() => expect(h.addComment).toHaveBeenCalledWith("great"));
    await waitFor(() => expect(input).toHaveValue(""));
  });
});

describe("BudgetCard", () => {
  const budget = (over: object) => ({ id: "b", amount: 100000, period: "MONTHLY", category: null, spent: 0, ...over });

  it("invites you to set a first budget", () => {
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByText(/no budgets set/i)).toBeInTheDocument();
  });

  it("shows remaining budget and percent used", () => {
    h.budget.data = { budgets: [budget({ spent: 25000 })] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByText("₹250.00 / ₹1,000.00")).toBeInTheDocument();
    expect(screen.getByText(/₹750\.00 remaining \(25% used\)/)).toBeInTheDocument();
  });

  it("warns at 80% and shows how far over you are past 100%", () => {
    h.budget.data = { budgets: [budget({ id: "warn", spent: 85000 }), budget({ id: "over", category: "FOOD", spent: 130000 })] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByText(/85% used/)).toBeInTheDocument();
    expect(screen.getByText("Over budget by ₹300.00")).toHaveClass("text-destructive");
  });

  it("says when spending in other currencies was converted into the budget's currency", () => {
    h.budget.data = { budgets: [budget({ spent: 25000 })], approximate: true, skipped: [] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByTestId("budget-converted")).toHaveTextContent("converted to INR");
    expect(screen.queryByTestId("budget-skipped")).not.toBeInTheDocument();
  });

  it("lists spending that could not be converted (no rate) rather than hiding it", () => {
    h.budget.data = { budgets: [budget({ spent: 25000 })], approximate: false, skipped: [{ currency: "USD", amount: 2000 }] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByTestId("budget-skipped")).toHaveTextContent(/no exchange rate/i);
    expect(screen.getByTestId("budget-skipped")).toHaveTextContent("$20.00");
  });

  it("shows no conversion notes for a single-currency budget", () => {
    h.budget.data = { budgets: [budget({ spent: 25000 })], approximate: false, skipped: [] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.queryByTestId("budget-converted")).not.toBeInTheDocument();
    expect(screen.queryByTestId("budget-skipped")).not.toBeInTheDocument();
  });

  it("labels category budgets and their period", () => {
    h.budget.data = { budgets: [budget({ category: "TRAVEL", period: "WEEKLY", spent: 10000 })] };
    render(<BudgetCard groupId="g1" currency="INR" />);
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("(weekly)")).toBeInTheDocument();
  });

  it("removes a budget", async () => {
    h.budget.data = { budgets: [budget({ id: "b9" })] };
    const { container } = render(<BudgetCard groupId="g1" currency="INR" />);
    await userEvent.click(container.querySelector("button.hover\\:text-destructive") as HTMLElement);
    expect(h.deleteBudget).toHaveBeenCalledWith("b9");
  });

  it("sets an overall monthly budget from the dialog, and ignores zero/empty amounts", async () => {
    render(<BudgetCard groupId="g1" currency="INR" />);
    await userEvent.click(screen.getByRole("button", { name: /set budget/i }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: /save budget/i });
    await userEvent.click(save);
    expect(h.setBudget).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByPlaceholderText("0.00"), "0");
    await userEvent.click(save);
    expect(h.setBudget).not.toHaveBeenCalled();
    await userEvent.clear(within(dialog).getByPlaceholderText("0.00"));
    await userEvent.type(within(dialog).getByPlaceholderText("0.00"), "2500");
    await userEvent.click(save);
    await waitFor(() => expect(h.setBudget).toHaveBeenCalledWith({ amount: 2500, category: null, period: "MONTHLY" }));
  });
});
