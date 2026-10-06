import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { toast, invalidate } = vi.hoisted(() => ({ toast: { error: vi.fn() }, invalidate: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: invalidate }) }));

import { ReactionBar, ReactionChips } from "@/components/expenses/reaction-bar";

const respond = (data: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => (ok ? { data, error: null } : { data: null, error: { message: "Expense not found" } }) });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", respond([])); });
afterEach(() => vi.unstubAllGlobals());

describe("ReactionChips (on an expense row)", () => {
  it("shows nothing when nobody reacted", () => {
    const { container } = render(<ReactionChips reactions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows the first three with counts, and +N for the rest; yours are highlighted", () => {
    render(<ReactionChips reactions={[{ emoji: "🍕", count: 2, mine: true }, { emoji: "🍻", count: 1, mine: false }, { emoji: "💸", count: 4, mine: false }, { emoji: "💀", count: 1, mine: false }, { emoji: "🔥", count: 1, mine: false }]} />);
    expect(screen.getByTestId("reaction-chips")).toHaveTextContent("🍕2");
    expect(screen.getByTestId("reaction-chips")).toHaveTextContent("+2");
    expect(screen.queryByText("💀")).toBeNull();
    expect(screen.getByText("2 reactions 🍕")).toBeInTheDocument(); // read out properly to screen readers
  });
});

describe("ReactionBar (in the expense details)", () => {
  it("shows existing reactions; yours is pressed", () => {
    render(<ReactionBar expenseId="e1" reactions={[{ emoji: "🍕", count: 2, mine: true }, { emoji: "🔥", count: 1, mine: false }]} />);
    expect(screen.getByRole("button", { name: /🍕 2 — you reacted/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "🔥 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the emoji picker, and tapping one sends it, shows it straight away, and refreshes the lists", async () => {
    vi.stubGlobal("fetch", respond([{ emoji: "🍻", count: 1, mine: true }]));
    render(<ReactionBar expenseId="e1" reactions={[]} />);
    expect(screen.queryByRole("group", { name: /choose a reaction/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /add a reaction/i }));
    expect(screen.getAllByRole("button", { name: /^React with /i })).toHaveLength(8);
    await userEvent.click(screen.getByRole("button", { name: "React with 🍻" }));
    expect(screen.getByRole("button", { name: /🍻 1 — you reacted/ })).toBeInTheDocument(); // picker closed, chip there
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/expenses/e1/reactions");
    expect(JSON.parse(init.body)).toEqual({ emoji: "🍻" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["expenses"] }));
  });

  it("tapping your own reaction again takes it back", async () => {
    vi.stubGlobal("fetch", respond([]));
    render(<ReactionBar expenseId="e1" reactions={[{ emoji: "🍕", count: 1, mine: true }]} />);
    await userEvent.click(screen.getByRole("button", { name: /🍕 1/ }));
    expect(screen.queryByRole("button", { name: /🍕/ })).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("someone else's count goes down by nothing when you undo a reaction you hadn't given (it just toggles yours on)", async () => {
    vi.stubGlobal("fetch", respond([{ emoji: "🔥", count: 2, mine: true }]));
    render(<ReactionBar expenseId="e1" reactions={[{ emoji: "🔥", count: 1, mine: false }]} />);
    await userEvent.click(screen.getByRole("button", { name: "🔥 1" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /🔥 2 — you reacted/ })).toBeInTheDocument());
  });

  it("if it can't be saved, the change is undone and the person is told", async () => {
    vi.stubGlobal("fetch", respond(null, false));
    render(<ReactionBar expenseId="e1" reactions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /add a reaction/i }));
    await userEvent.click(screen.getByRole("button", { name: "React with 💀" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Expense not found"));
    expect(screen.queryByRole("button", { name: /💀/ })).toBeNull();
  });

  it("survives the network being down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ReactionBar expenseId="e1" reactions={[{ emoji: "🍕", count: 1, mine: false }]} />);
    await userEvent.click(screen.getByRole("button", { name: "🍕 1" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "🍕 1" })).toBeInTheDocument(); // put back
  });

  it("follows new data from the server (e.g. after the list refreshes)", () => {
    const { rerender } = render(<ReactionBar expenseId="e1" reactions={[]} />);
    expect(screen.queryByRole("button", { name: /🔥/ })).toBeNull();
    rerender(<ReactionBar expenseId="e1" reactions={[{ emoji: "🔥", count: 3, mine: false }]} />);
    expect(screen.getByRole("button", { name: "🔥 3" })).toBeInTheDocument();
  });
});
