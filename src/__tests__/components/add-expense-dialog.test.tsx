import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mutateAsync, toast, state } = vi.hoisted(() => ({
  mutateAsync: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  state: { groups: [] as unknown[], group: undefined as unknown, friends: [] as unknown[], home: "INR" },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me", email: "me@x.com", user_metadata: { name: "Nishant Kumar" } } }) }));
vi.mock("@/hooks/use-expenses", () => ({ useCreateExpense: () => ({ mutateAsync, isPending: false }) }));
vi.mock("@/hooks/use-groups", () => ({ useGroups: () => ({ data: state.groups }), useGroup: () => ({ data: state.group }) }));
vi.mock("@/hooks/use-friends", () => ({ useFriendContacts: () => ({ data: state.friends }) }));
vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => state.home }));

import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";

const member = (id: string, name: string) => ({ id, groupId: "g1", userId: id, role: "MEMBER", joinedAt: new Date(), user: { id, name, email: "", avatarUrl: null } });
const members = [member("me", "Nishant Kumar"), member("a", "Asha Rao"), member("b", "Bhanu Pal")];

const renderGroup = (over: Record<string, unknown> = {}) =>
  render(<AddExpenseDialog open onOpenChange={vi.fn()} groupId="g1" groupCurrency="INR" members={members as never} {...over} />);

const fill = async (description: string, amount: string) => {
  await userEvent.type(screen.getByPlaceholderText(/dinner, groceries, rent/i), description);
  await userEvent.type(screen.getByPlaceholderText("0.00"), amount);
};
// "Who paid" chips and "who shares it" chips use the same names, so each query is scoped to its section
const participants = () => within(screen.getByText(/select participants/i).parentElement as HTMLElement);
const payers = () => within(screen.getByTestId("payers-editor"));
const submit = () => userEvent.click(screen.getByRole("button", { name: /^add expense$/i }));

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({});
  state.groups = [{ id: "g1", name: "Goa Trip" }];
  state.group = undefined;
  state.friends = [];
  state.home = "INR";
});

describe("AddExpenseDialog — a group expense", () => {
  it("submits an equal split between everyone, paid by me, in the group's currency", async () => {
    renderGroup();
    await fill("Dinner", "900");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      description: "Dinner", amount: 900, currency: "INR", splitType: "EQUAL", paidById: "me", groupId: "g1",
      participants: ["me", "a", "b"], isRecurring: false,
    });
    expect(payload.splits).toBeUndefined(); // equal splits are computed on the server
    expect(payload).not.toHaveProperty("payers");
  });

  it("shows a live equal-split preview", async () => {
    renderGroup();
    await userEvent.type(screen.getByPlaceholderText("0.00"), "900");
    expect(screen.getAllByText(/300\.00 INR/)).toHaveLength(3);
  });

  it("the preview shows each person's REAL share — the same cents the server saves — so ₹100 between 3 is 33.34 / 33.33 / 33.33, never '33.33 each' (99.99)", async () => {
    renderGroup();
    await userEvent.type(screen.getByPlaceholderText("0.00"), "100");
    expect(screen.getAllByText(/33\.34 INR/)).toHaveLength(1);
    expect(screen.getAllByText(/33\.33 INR/)).toHaveLength(2);
    // and they really add up
    const shown = Array.from(document.body.textContent!.matchAll(/(\d+\.\d\d) INR/g)).map((m) => Math.round(parseFloat(m[1]) * 100));
    expect(shown.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("auto-categorises from the description (dinner → food)", async () => {
    renderGroup();
    await fill("Dinner at Taj", "500");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].category).toBe("FOOD");
  });

  it("won't submit without a description or amount", async () => {
    renderGroup();
    await submit();
    expect(mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("deselecting someone removes ONLY them (regression: it used to select only them)", async () => {
    renderGroup();
    await fill("Taxi", "300");
    await userEvent.click(participants().getByRole("button", { name: /bhanu/i }));
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].participants).toEqual(["me", "a"]);
  });

  it("can re-add someone who was removed, and never lets the last person be removed", async () => {
    renderGroup();
    await userEvent.type(screen.getByPlaceholderText("0.00"), "300");
    await userEvent.click(participants().getByRole("button", { name: /asha/i }));
    await userEvent.click(participants().getByRole("button", { name: /bhanu/i }));
    expect(screen.getAllByText(/300\.00 INR/)).toHaveLength(1); // only "You" is left
    await userEvent.click(participants().getByRole("button", { name: /you/i })); // can't remove the last person
    expect(screen.getAllByText(/300\.00 INR/)).toHaveLength(1);
    await userEvent.click(participants().getByRole("button", { name: /asha/i })); // add back
    expect(screen.getAllByText(/150\.00 INR/)).toHaveLength(2);
  });
});

describe("AddExpenseDialog — unequal splits", () => {
  const openTab = (name: RegExp) => userEvent.click(screen.getByRole("tab", { name }));

  it("labels the tabs without a hardcoded currency symbol", () => {
    renderGroup();
    expect(screen.queryByText(/exact \$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /exact/i })).toBeInTheDocument();
  });

  it("exact: blocks submission until the amounts add up to the total, then sends them", async () => {
    renderGroup();
    await fill("Hotel", "1000");
    await openTab(/exact/i);
    const inputs = screen.getAllByPlaceholderText("0.00").slice(1); // first one is the total
    await userEvent.type(inputs[0], "500");
    await userEvent.type(inputs[1], "300");
    expect(screen.getByText(/must sum to 1000\.00 \(currently 800\.00\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^add expense$/i })).toBeDisabled();
    await userEvent.type(inputs[2], "200");
    expect(screen.queryByText(/must sum to/i)).not.toBeInTheDocument();
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ splitType: "EXACT", splits: { me: 500, a: 300, b: 200 } });
  });

  it("exact: ONE cent off is caught right here, not after submitting (the server is exact)", async () => {
    renderGroup();
    await fill("Hotel", "100");
    await openTab(/exact/i);
    const inputs = screen.getAllByPlaceholderText("0.00").slice(1);
    await userEvent.type(inputs[0], "33.33");
    await userEvent.type(inputs[1], "33.33");
    await userEvent.type(inputs[2], "33.33");
    expect(screen.getByText(/must sum to 100\.00 \(currently 99\.99\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^add expense$/i })).toBeDisabled();
    await userEvent.clear(inputs[2]);
    await userEvent.type(inputs[2], "33.34");
    expect(screen.queryByText(/must sum to/i)).not.toBeInTheDocument();
  });

  it("percentage: must sum to 100", async () => {
    renderGroup();
    await fill("Rent", "1000");
    await openTab(/percent/i);
    const inputs = screen.getAllByPlaceholderText("%");
    await userEvent.type(inputs[0], "50");
    await userEvent.type(inputs[1], "30");
    expect(screen.getByText(/percentages must sum to 100/i)).toBeInTheDocument();
    await userEvent.type(inputs[2], "20");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ splitType: "PERCENTAGE", splits: { me: 50, a: 30, b: 20 } });
  });

  it("shares: sends the share counts", async () => {
    renderGroup();
    await fill("Groceries", "600");
    await openTab(/shares/i);
    const inputs = screen.getAllByPlaceholderText("shares");
    await userEvent.type(inputs[0], "2");
    await userEvent.type(inputs[1], "1");
    await userEvent.type(inputs[2], "1");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ splitType: "SHARES", splits: { me: 2, a: 1, b: 1 } });
  });
});

describe("AddExpenseDialog — who paid", () => {
  it("choose another single payer", async () => {
    renderGroup();
    await fill("Cab", "400");
    await userEvent.click(payers().getByRole("button", { name: /asha/i }));
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ paidById: "a" });
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty("payers");
  });

  it("multiple payers: sends each amount, and refuses amounts that don't add up", async () => {
    renderGroup();
    await fill("Hotel", "900");
    await userEvent.click(screen.getByRole("button", { name: /multiple payers/i }));
    const paid = (who: RegExp) => screen.getByLabelText(who);
    await userEvent.clear(paid(/paid by you/i)); await userEvent.type(paid(/paid by you/i), "600");
    await userEvent.clear(paid(/paid by asha/i)); await userEvent.type(paid(/paid by asha/i), "200");
    await userEvent.clear(paid(/paid by bhanu/i)); await userEvent.type(paid(/paid by bhanu/i), "50");
    await submit();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/less than the total/i));

    await userEvent.clear(paid(/paid by bhanu/i)); await userEvent.type(paid(/paid by bhanu/i), "100");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.payers).toEqual([{ userId: "me", amount: 600 }, { userId: "a", amount: 200 }, { userId: "b", amount: 100 }]);
    expect(payload.paidById).toBe("me");
  });
});

describe("AddExpenseDialog — standalone (no group)", () => {
  it("offers quick add that fills the form from plain text", async () => {
    state.friends = [{ friendId: "a", friend: { name: "Asha Rao" } }, { friendId: "b", friend: { name: "Bhanu Pal" } }];
    render(<AddExpenseDialog open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/dinner 1200 with rahul/i), "Dinner 1200 with Asha and Bhanu{Enter}");
    expect(screen.getByPlaceholderText(/dinner, groceries, rent/i)).toHaveValue("Dinner");
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(1200);
  });

  it("tells you which names it couldn't find", async () => {
    state.friends = [{ friendId: "a", friend: { name: "Asha Rao" } }];
    render(<AddExpenseDialog open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/dinner 1200 with rahul/i), "Movie 400 with Asha and Zed{Enter}");
    expect(toast.info).toHaveBeenCalledWith("Couldn't find: Zed");
  });

  it("quick add isn't shown inside a group", () => {
    renderGroup();
    expect(screen.queryByPlaceholderText(/dinner 1200 with rahul/i)).not.toBeInTheDocument();
  });

  it("requires a group when splitting with a group", async () => {
    render(<AddExpenseDialog open onOpenChange={vi.fn()} />);
    await fill("Dinner", "500");
    await submit();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Please select a group or change split context"));
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe("AddExpenseDialog — currency", () => {
  it("inside a group the group's currency applies, whatever the home currency is", async () => {
    state.home = "USD";
    renderGroup({ groupCurrency: "INR" });
    await fill("Dinner", "100");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].currency).toBe("INR");
  });

  it("outside a group, expenses start in the user's home currency", async () => {
    state.home = "USD";
    state.group = undefined;
    render(<AddExpenseDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /personal|just me/i }));
    await fill("Coffee", "5");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].currency).toBe("USD");
  });

  it("picking a group in the standalone dialog switches to that group's currency", async () => {
    state.home = "USD";
    state.groups = [{ id: "g1", name: "Goa Trip" }];
    state.group = { id: "g1", currency: "INR", members };
    render(<AddExpenseDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByText(/choose a group/i).closest("button") as HTMLElement);
    await userEvent.click(await screen.findByRole("option", { name: "Goa Trip" }));
    await fill("Dinner", "100");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].currency).toBe("INR");
  });
});

describe("AddExpenseDialog — yen has no decimals", () => {
  it("the amount box takes whole numbers only (step 1) and the preview shows no decimals", async () => {
    renderGroup({ groupCurrency: "JPY" });
    const amount = screen.getByPlaceholderText("0");
    expect(amount).toHaveAttribute("step", "1");
    await userEvent.type(amount, "1000");
    expect(screen.getAllByText(/333 JPY/).length).toBeGreaterThan(0);
  });

  it("a fractional yen amount is stopped before it is sent (the browser's own number check flags it)", async () => {
    renderGroup({ groupCurrency: "JPY" });
    await userEvent.type(screen.getByPlaceholderText(/dinner, groceries, rent/i), "Ramen");
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await userEvent.type(amount, "100.5");
    expect(amount.validity.stepMismatch).toBe(true);
    await submit();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("a whole-yen amount is sent as usual", async () => {
    renderGroup({ groupCurrency: "JPY" });
    await userEvent.type(screen.getByPlaceholderText(/dinner, groceries, rent/i), "Ramen");
    await userEvent.type(screen.getByPlaceholderText("0"), "1200");
    await submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ amount: 1200, currency: "JPY" });
  });

  it("other currencies keep two decimals", () => {
    renderGroup({ groupCurrency: "USD" });
    expect(screen.getByPlaceholderText("0.00")).toHaveAttribute("step", "0.01");
  });
});
