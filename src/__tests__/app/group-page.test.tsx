import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  group: { data: undefined as unknown, isLoading: false },
  expenses: { expenses: [] as unknown[], isLoading: false, hasNextPage: false, fetchNextPage: vi.fn(), isFetchingNextPage: false },
  friends: { data: [] as unknown[] },
  hooks: {
    deleteGroup: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), leave: vi.fn(), transfer: vi.fn(), archive: vi.fn(),
    settleUp: vi.fn(), deleteExpense: vi.fn(),
  },
  router: { back: vi.fn(), push: vi.fn() },
  useInfiniteExpenses: vi.fn(),
  user: { id: "me" },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => h.router }));
vi.mock("usehooks-ts", () => ({ useDebounceValue: (v: unknown) => [v] }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/hooks/use-friends", () => ({ useFriendContacts: () => h.friends }));
vi.mock("@/hooks/use-groups", () => ({
  useGroup: () => h.group,
  useDeleteGroup: () => ({ mutateAsync: h.hooks.deleteGroup }),
  useAddMember: () => ({ mutateAsync: h.hooks.addMember, isPending: false }),
  useRemoveMember: () => ({ mutate: h.hooks.removeMember }),
  useLeaveGroup: () => ({ mutateAsync: h.hooks.leave }),
  useTransferOwnership: () => ({ mutateAsync: h.hooks.transfer }),
  useArchiveGroup: () => ({ mutateAsync: h.hooks.archive, mutate: h.hooks.archive, isPending: false }),
}));
vi.mock("@/hooks/use-settlements", () => ({ useSettleUp: () => ({ mutateAsync: h.hooks.settleUp, isPending: false }) }));
vi.mock("@/hooks/use-expenses", () => ({
  useDeleteExpense: () => ({ mutate: h.hooks.deleteExpense }),
  useInfiniteExpenses: (q: unknown) => { h.useInfiniteExpenses(q); return h.expenses; },
}));
vi.mock("@/components/expenses/lazy-add-expense-dialog", () => ({ LazyAddExpenseDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="add-expense-dialog">{children}</div> }));
vi.mock("@/components/groups/edit-group-dialog", () => ({ EditGroupDialog: () => <div data-testid="edit-group" /> }));
vi.mock("@/components/groups/budget-card", () => ({ BudgetCard: () => <div data-testid="budget-card" /> }));
vi.mock("@/components/groups/group-debts-card", () => ({ GroupDebtsCard: () => <div data-testid="debts-card" /> }));
vi.mock("@/components/groups/group-stats-card", () => ({ GroupStatsCard: () => <div data-testid="stats-card" /> }));
vi.mock("@/components/expenses/expense-comments", () => ({ ExpenseComments: () => <div /> }));
vi.mock("@/components/expenses/expense-history", () => ({ ExpenseHistory: () => <div /> }));
vi.mock("@/components/expenses/reaction-bar", async (orig) => ({ ...(await orig<typeof import("@/components/expenses/reaction-bar")>()), ReactionBar: ({ expenseId }: { expenseId: string }) => <div data-testid="reaction-bar-stub" data-expense={expenseId} /> })); // (the real bar needs a QueryClient; the chips on rows are real)

import { toast } from "sonner";
import GroupDetailPage from "@/app/(dashboard)/groups/[id]/page";

const member = (id: string, name: string, role = "MEMBER") => ({ id: `m-${id}`, userId: id, role, user: { id, name, email: `${name.toLowerCase()}@x.com`, avatarUrl: null } });
const baseGroup = (over: Record<string, unknown> = {}) => ({
  id: "g1", name: "Goa Trip", description: "Beach", currency: "INR", createdById: "me", archivedAt: null,
  members: [member("me", "Nishant", "ADMIN"), member("a", "Asha"), member("b", "Bhanu")],
  memberBalances: [], _count: { expenses: 3, members: 3 }, stats: undefined, ...over,
});
const expense = (id: string) => ({ id, description: `Expense ${id}`, amount: 10000, currency: "INR", category: "FOOD", date: "2026-03-01", paidById: "me", paidBy: { name: "Nishant" }, splits: [{ userId: "me", amount: 5000 }, { userId: "a", amount: 5000 }], payers: [] });

async function renderPage() {
  await act(async () => {
    render(<Suspense fallback={null}><GroupDetailPage params={Promise.resolve({ id: "g1" })} /></Suspense>);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.group.data = baseGroup(); h.group.isLoading = false;
  h.expenses.expenses = [expense("1"), expense("2")]; h.expenses.isLoading = false; h.expenses.hasNextPage = false;
  h.friends.data = [];
  h.user.id = "me";
  vi.stubGlobal("confirm", vi.fn(() => true));
  Object.values(h.hooks).forEach((f) => f.mockResolvedValue({}));
});

describe("GroupDetailPage — an expense in another currency", () => {
  it("the details dialog shows the total and each split in the EXPENSE's currency, not the group's", async () => {
    h.expenses.expenses = [{ ...expense("1"), description: "Hotel", currency: "USD", amount: 20000, splits: [{ userId: "me", amount: 10000, user: { name: "Nishant" } }, { userId: "a", amount: 10000, user: { name: "Asha" } }] }];
    await renderPage();
    await userEvent.click(screen.getByText("Hotel"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("$200.00");
    expect(dialog).toHaveTextContent("$100.00");
    expect(dialog).not.toHaveTextContent("₹");
  });
});

describe("GroupDetailPage — invite on WhatsApp", () => {
  it("opens WhatsApp with a ready message naming the group and carrying its join link", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: { token: "tok123" } }) }));
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Invite on WhatsApp" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.origin).toBe("https://wa.me");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Goa Trip");
    expect(text).toContain(`${window.location.origin}/join/tok123`);
  });

  it("says so (and opens nothing) when the invite link can't be made", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "no" } }) }));
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Invite on WhatsApp" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to generate invite link"));
    expect(open).not.toHaveBeenCalled();
  });
});

describe("GroupDetailPage — basics", () => {
  it("shows skeletons while loading and nothing for a missing group", async () => {
    h.group.isLoading = true;
    const { unmount } = (await renderPage(), { unmount: () => {} });
    expect(screen.queryByText("Goa Trip")).not.toBeInTheDocument();
    unmount();
    document.body.innerHTML = "";
    h.group.isLoading = false; h.group.data = undefined;
    await renderPage();
    expect(screen.queryByText("Members")).not.toBeInTheDocument();
  });

  it("shows the group header, members with roles, and the sub-cards", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "Goa Trip" })).toBeInTheDocument();
    expect(screen.getByText("Beach")).toBeInTheDocument();
    expect(screen.getByText("Members (3)")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getAllByText("Admin")).toHaveLength(1);
    for (const id of ["debts-card", "stats-card", "budget-card"]) expect(screen.getByTestId(id)).toBeInTheDocument();
  });

  it("fetches the group's own expense history with the group id", async () => {
    await renderPage();
    expect(h.useInfiniteExpenses).toHaveBeenCalledWith({ groupId: "g1", q: "" });
  });
});

describe("GroupDetailPage — your balance banner (regression: it always said 'All settled up!')", () => {
  it("is 'All settled up!' only when nobody owes anyone", async () => {
    await renderPage();
    expect(screen.getByText("All settled up!")).toBeInTheDocument();
  });

  it("'You are owed' = the sum of what everyone else owes you", async () => {
    h.group.data = baseGroup({ memberBalances: [
      { userId: "a", name: "Asha", avatarUrl: null, balance: 30000, others: [] },
      { userId: "b", name: "Bhanu", avatarUrl: null, balance: 20000, others: [] },
    ] });
    await renderPage();
    expect(screen.getByText("You are owed")).toBeInTheDocument();
    expect(screen.getByText("₹500.00", { selector: "p.text-3xl" })).toBeInTheDocument();
  });

  it("'You owe' when you owe more than you're owed, netting across members", async () => {
    h.group.data = baseGroup({ memberBalances: [
      { userId: "a", name: "Asha", avatarUrl: null, balance: -50000, others: [] },
      { userId: "b", name: "Bhanu", avatarUrl: null, balance: 10000, others: [] },
    ] });
    await renderPage();
    expect(screen.getByText("You owe")).toBeInTheDocument();
    expect(screen.getByText("₹400.00", { selector: "p.text-3xl" })).toBeInTheDocument();
  });
});

describe("GroupDetailPage — who owes who & settling", () => {
  beforeEach(() => {
    h.group.data = baseGroup({ memberBalances: [
      { userId: "a", name: "Asha", avatarUrl: null, balance: -25000, others: [] }, // I owe Asha
      { userId: "b", name: "Bhanu", avatarUrl: null, balance: 10000, others: [] }, // Bhanu owes me
    ] });
  });

  it("shows each person with direction and amount, and Settle only where I owe", async () => {
    await renderPage();
    expect(screen.getByText("Who owes who")).toBeInTheDocument();
    expect(screen.getByText(/simplified plan below can route payments differently/i)).toBeInTheDocument(); // two sets of numbers, both right: say why they differ
    expect(screen.getByText("you owe")).toBeInTheDocument();
    expect(screen.getByText("owes you")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Settle" })).toHaveLength(1);
  });

  it("settles the full amount with the group's id and currency, with an optional note", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Settle" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Settle with Asha")).toBeInTheDocument();
    expect(within(dialog).getByText("₹250.00")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByPlaceholderText(/paid via upi/i), "GPay");
    await userEvent.click(within(dialog).getByRole("button", { name: /record full payment/i }));
    await waitFor(() => expect(h.hooks.settleUp).toHaveBeenCalled());
    expect(h.hooks.settleUp.mock.calls[0][0]).toEqual({ toUserId: "a", amount: 250, currency: "INR", groupId: "g1", note: "GPay" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("GroupDetailPage — expenses", () => {
  it("lists expenses under the group's real total (not just the loaded page)", async () => {
    h.group.data = baseGroup({ _count: { expenses: 240, members: 3 } });
    await renderPage();
    expect(screen.getByText("Expenses (240)")).toBeInTheDocument();
    expect(screen.getByText("Expense 1")).toBeInTheDocument();
  });

  it("offers Load more when there are more pages", async () => {
    h.expenses.hasNextPage = true;
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(h.expenses.fetchNextPage).toHaveBeenCalledOnce();
  });

  it("shows search for busy groups and sends it to the server", async () => {
    h.group.data = baseGroup({ _count: { expenses: 40, members: 3 } });
    await renderPage();
    await userEvent.type(screen.getByLabelText(/search this group's expenses/i), "taxi");
    expect(h.useInfiniteExpenses).toHaveBeenLastCalledWith({ groupId: "g1", q: "taxi" });
  });

  it("hides search for tiny groups", async () => {
    await renderPage();
    expect(screen.queryByLabelText(/search this group's expenses/i)).not.toBeInTheDocument();
  });

  it("distinguishes 'no expenses yet' from 'no match'", async () => {
    h.expenses.expenses = [];
    h.group.data = baseGroup({ _count: { expenses: 40, members: 3 } });
    await renderPage();
    expect(screen.getByText(/no expenses yet/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/search this group's expenses/i), "zzz");
    expect(screen.getByText(/no expenses match your search/i)).toBeInTheDocument();
  });

  it("deleting an expense passes the whole expense (so Undo can restore it)", async () => {
    await renderPage();
    const row = screen.getByText("Expense 1").closest("div.group") as HTMLElement;
    const buttons = within(row).getAllByRole("button");
    await userEvent.click(buttons[buttons.length - 1]); // delete is the last action
    expect(h.hooks.deleteExpense).toHaveBeenCalledWith(expect.objectContaining({ id: "1", description: "Expense 1" }));
  });
});

describe("GroupDetailPage — archived groups are read-only", () => {
  it("shows a banner, hides Add expense and Add member, and lets admins restore", async () => {
    h.group.data = baseGroup({ archivedAt: "2026-03-01T00:00:00Z" });
    await renderPage();
    expect(screen.getByText(/this group is archived/i)).toBeInTheDocument();
    expect(screen.queryByTestId("add-expense-dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add member/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^restore$/i }));
    expect(h.hooks.archive).toHaveBeenCalledWith({ id: "g1", archived: false });
  });

  it("non-admins see the banner but no Restore button", async () => {
    h.user.id = "a";
    h.group.data = baseGroup({ archivedAt: "2026-03-01T00:00:00Z", createdById: "me" });
    await renderPage();
    expect(screen.getByText(/this group is archived/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^restore$/i })).not.toBeInTheDocument();
  });

  it("active groups show Add expense and no banner", async () => {
    await renderPage();
    expect(screen.getByTestId("add-expense-dialog")).toBeInTheDocument();
    expect(screen.queryByText(/this group is archived/i)).not.toBeInTheDocument();
  });
});

describe("GroupDetailPage — members", () => {
  it("admins can remove members and make someone admin; members can't", async () => {
    await renderPage();
    expect(screen.getAllByTitle("Make admin")).toHaveLength(2);
    h.group.data = baseGroup({ members: [member("me", "Nishant", "MEMBER"), member("a", "Asha", "ADMIN")], createdById: "a" });
    document.body.innerHTML = "";
    await renderPage();
    expect(screen.queryByTitle("Make admin")).not.toBeInTheDocument();
  });

  it("removes a member", async () => {
    await renderPage();
    const asha = screen.getByText("Asha").closest("div.flex.items-center.gap-3") as HTMLElement;
    const buttons = within(asha).getAllByRole("button");
    await userEvent.click(buttons[buttons.length - 1]);
    expect(h.hooks.removeMember).toHaveBeenCalledWith({ groupId: "g1", userId: "a" });
  });

  it("adds a member by email", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /add member/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByPlaceholderText("friend@example.com"), "new@x.com");
    await userEvent.click(within(dialog).getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(h.hooks.addMember).toHaveBeenCalledWith({ groupId: "g1", email: "new@x.com" }));
  });

  it("the friend picker offers only people not already in the group, filtered by search", async () => {
    h.friends.data = [
      { friendId: "a", friend: { name: "Asha", email: "asha@x.com", avatarUrl: null } }, // already a member
      { friendId: "c", friend: { name: "Chitra Shah", email: "chitra@x.com", avatarUrl: null } },
      { friendId: "d", friend: { name: "Divya Rao", email: "divya@x.com", avatarUrl: null } },
    ];
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /add member/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Asha")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Chitra Shah")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByPlaceholderText(/search friends/i), "div");
    expect(within(dialog).queryByText("Chitra Shah")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByText("Divya Rao"));
    await waitFor(() => expect(h.hooks.addMember).toHaveBeenCalledWith({ groupId: "g1", email: "divya@x.com" }));
  });

  it("says when all your friends are already in the group", async () => {
    h.friends.data = [{ friendId: "a", friend: { name: "Asha", email: "asha@x.com", avatarUrl: null } }];
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /add member/i }));
    expect(await screen.findByText(/all your friends are already in this group/i)).toBeInTheDocument();
  });
});

describe("GroupDetailPage — leaving and deleting", () => {
  it("the creator can delete (after confirming) and is sent to the groups list", async () => {
    await renderPage();
    await userEvent.click(screen.getByTitle("Delete group"));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/cannot be undone/i));
    await waitFor(() => expect(h.hooks.deleteGroup).toHaveBeenCalledWith("g1"));
    expect(h.router.push).toHaveBeenCalledWith("/groups");
  });

  it("declining the confirmation does nothing", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await renderPage();
    await userEvent.click(screen.getByTitle("Delete group"));
    expect(h.hooks.deleteGroup).not.toHaveBeenCalled();
  });

  it("non-creators can leave instead; the creator can't 'leave'", async () => {
    h.user.id = "a";
    h.group.data = baseGroup({ createdById: "me" });
    await renderPage();
    expect(screen.queryByTitle("Delete group")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTitle(/leave group/i));
    await waitFor(() => expect(h.hooks.leave).toHaveBeenCalledWith({ groupId: "g1", userId: "a" }));
    expect(h.router.push).toHaveBeenCalledWith("/groups");
  });

  it("stays on the page when leaving is refused (unsettled balance)", async () => {
    h.user.id = "a";
    h.hooks.leave.mockRejectedValue(new Error("You owe money in this group"));
    await renderPage();
    await userEvent.click(screen.getByTitle(/leave group/i));
    await waitFor(() => expect(h.hooks.leave).toHaveBeenCalled());
    expect(h.router.push).not.toHaveBeenCalled();
  });
});

describe("GroupDetailPage — balance banner", () => {
  it("is a calm tinted card in both themes (soft green when you are owed, soft red when you owe), not a solid slab", () => {
    const src = readFileSync("src/app/(dashboard)/groups/[id]/page.tsx", "utf8");
    expect(src).toContain("border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15");
    expect(src).toContain("border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/15");
    expect(src).not.toContain("from-emerald-500 to-green-600");
  });
});
