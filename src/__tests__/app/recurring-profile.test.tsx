import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createHarness } from "../hooks/harness";

const h = vi.hoisted(() => ({
  rec: { expenses: [] as unknown[], isLoading: false, hasNextPage: false, fetchNextPage: vi.fn(), isFetchingNextPage: false },
  useInfiniteExpenses: vi.fn(), deleteExpense: vi.fn(),
  user: { value: { id: "me", email: "me@x.com", created_at: "2024-05-01T00:00:00Z", user_metadata: { name: "Nishant Kumar" } } as unknown },
  signOut: vi.fn(), push: vi.fn(), updateUser: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: h.user.value, signOut: h.signOut }) }));
vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => "INR" }));
vi.mock("@/hooks/use-expenses", () => ({
  useInfiniteExpenses: (q: unknown) => { h.useInfiniteExpenses(q); return h.rec; },
  useDeleteExpense: () => ({ mutate: h.deleteExpense }),
}));
vi.mock("@/components/expenses/add-expense-dialog", () => ({ AddExpenseDialog: ({ open }: { open?: boolean }) => (open ? <div data-testid="add-dialog" /> : null) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { updateUser: h.updateUser } }) }));
import RecurringPage from "@/app/(dashboard)/recurring/page";
import ProfilePage from "@/app/(dashboard)/profile/page";

const rec = (over: object) => ({ id: Math.random().toString(), description: "Netflix", amount: 64900, currency: "INR", category: "ENTERTAINMENT", paidById: "me", paidBy: { name: "Nishant" }, isRecurring: true, recurringInterval: "MONTHLY", date: "2026-01-05", group: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  h.rec.expenses = []; h.rec.isLoading = false; h.rec.hasNextPage = false;
  h.updateUser.mockResolvedValue({});
  h.signOut.mockResolvedValue(undefined);
  h.user.value = { id: "me", email: "me@x.com", created_at: "2024-05-01T00:00:00Z", user_metadata: { name: "Nishant Kumar" } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: {} }) }));
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("RecurringPage", () => {
  it("asks the server for recurring expenses only (not the latest 50 of everything)", () => {
    render(<RecurringPage />);
    expect(h.useInfiniteExpenses).toHaveBeenCalledWith({ recurring: true, limit: 100 });
  });

  it("has a helpful empty state", () => {
    render(<RecurringPage />);
    expect(screen.getByText("No recurring expenses")).toBeInTheDocument();
    expect(screen.getByText("0 active subscriptions")).toBeInTheDocument();
  });

  it("shows loading skeletons without the empty state", () => {
    h.rec.isLoading = true;
    render(<RecurringPage />);
    expect(screen.queryByText("No recurring expenses")).not.toBeInTheDocument();
  });

  it("lists each expense with its interval, start date, and amount in ITS OWN currency", () => {
    h.rec.expenses = [rec({ description: "Netflix" }), rec({ description: "Spotify", amount: 999, currency: "USD", recurringInterval: "YEARLY", group: { name: "Flat", currency: "INR" } })];
    render(<RecurringPage />);
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("₹649.00")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument(); // not forced into the group's / profile currency
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getByText(/· Flat/)).toBeInTheDocument();
  });

  it("estimates the monthly cost per currency (never adding rupees to dollars)", () => {
    h.rec.expenses = [
      rec({ amount: 50000 }), // ₹500 monthly
      rec({ amount: 120000, recurringInterval: "YEARLY" }), // ₹1,000/yr → ₹100/mo
      rec({ amount: 1000, currency: "USD" }), // $10 monthly
    ];
    render(<RecurringPage />);
    expect(screen.getByText("₹600.00 + $10.00")).toBeInTheDocument();
    expect(screen.getByText(/across 3 recurring expenses/)).toBeInTheDocument();
  });

  it("only the payer can stop a recurring expense (after confirming)", async () => {
    const mine = rec({ description: "Mine" });
    h.rec.expenses = [mine, rec({ description: "Theirs", paidById: "someone" })];
    const { container } = render(<RecurringPage />);
    const stops = container.querySelectorAll("button.hover\\:text-destructive");
    expect(stops).toHaveLength(1);
    await userEvent.click(stops[0]);
    expect(confirm).toHaveBeenCalled();
    expect(h.deleteExpense).toHaveBeenCalledWith(mine); // whole expense, so Undo works
  });

  it("does nothing when the confirmation is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    h.rec.expenses = [rec({})];
    const { container } = render(<RecurringPage />);
    await userEvent.click(container.querySelector("button.hover\\:text-destructive") as HTMLElement);
    expect(h.deleteExpense).not.toHaveBeenCalled();
  });

  it("loads more when there are more recurring expenses", async () => {
    h.rec.expenses = [rec({})];
    h.rec.hasNextPage = true;
    render(<RecurringPage />);
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(h.rec.fetchNextPage).toHaveBeenCalled();
  });
});

describe("ProfilePage", () => {
  const renderProfile = () => {
    const harness = createHarness();
    render(<ProfilePage />, { wrapper: harness.wrapper });
    return harness;
  };

  it("shows name, email and member-since year", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: "Nishant Kumar" })).toBeInTheDocument();
    expect(screen.getAllByText("me@x.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Member since 2024")).toBeInTheDocument();
  });

  it("never shows 'Member since NaN' when the signup date is unknown", () => {
    h.user.value = { id: "me", email: "me@x.com", user_metadata: { name: "N" } };
    renderProfile();
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
  });

  it("saves the new name to the database AND the auth profile (so the greeting updates)", async () => {
    const { invalidated } = renderProfile();
    const input = screen.getByPlaceholderText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "Nishant K");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ data: { name: "Nishant K" } }));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/profile");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Nishant K" });
    expect(invalidated()).toContainEqual(["profile"]);
    expect(h.toast.success).toHaveBeenCalledWith("Profile updated");
  });

  it("still reports success if only the auth-profile sync fails (the database row is saved)", async () => {
    h.updateUser.mockRejectedValue(new Error("network"));
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Profile updated"));
  });

  it("shows the server's validation error and doesn't claim success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Name is required" } }) }));
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Name is required"));
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("the email field is read-only", () => {
    renderProfile();
    expect(screen.getByDisplayValue("me@x.com")).toBeDisabled();
  });

  it("signs out and returns to the login page", async () => {
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    expect(h.push).toHaveBeenCalledWith("/login");
  });
});
