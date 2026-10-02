import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ loads: vi.fn(), props: vi.fn() }));
// The real dialog is heavy; a stand-in lets us see when it is mounted and what it was given
vi.mock("@/components/expenses/add-expense-dialog", () => {
  h.loads();
  return {
    AddExpenseDialog: (props: { open?: boolean; onOpenChange?: (o: boolean) => void; groupId?: string }) => {
      h.props(props);
      return <div data-testid="dialog" data-open={String(props.open)} data-group={props.groupId}><button onClick={() => props.onOpenChange?.(false)}>close</button></div>;
    },
  };
});

import { LazyAddExpenseDialog, preloadAddExpenseDialog } from "@/components/expenses/lazy-add-expense-dialog";

beforeEach(() => { vi.clearAllMocks(); });

describe("LazyAddExpenseDialog — controlled", () => {
  it("renders nothing and does not load the form while closed", () => {
    render(<LazyAddExpenseDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("mounts the form when open becomes true, and keeps it mounted so it can animate closed", async () => {
    const { rerender } = render(<LazyAddExpenseDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<LazyAddExpenseDialog open onOpenChange={vi.fn()} />);
    expect(await screen.findByTestId("dialog")).toHaveAttribute("data-open", "true");
    rerender(<LazyAddExpenseDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false");
  });

  it("forwards onOpenChange and the group props", async () => {
    const onOpenChange = vi.fn();
    render(<LazyAddExpenseDialog open onOpenChange={onOpenChange} groupId="g1" />);
    expect(await screen.findByTestId("dialog")).toHaveAttribute("data-group", "g1");
    await userEvent.click(screen.getByText("close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("LazyAddExpenseDialog — with a trigger", () => {
  it("shows the trigger immediately, and opens the form on click", async () => {
    render(<LazyAddExpenseDialog groupId="g1"><button>Add expense</button></LazyAddExpenseDialog>);
    expect(screen.getByRole("button", { name: "Add expense" })).toBeInTheDocument();
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await screen.findByTestId("dialog")).toHaveAttribute("data-open", "true");
  });

  it("closes again through the dialog and can be reopened", async () => {
    render(<LazyAddExpenseDialog><button>Add</button></LazyAddExpenseDialog>);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(await screen.findByText("close"));
    await waitFor(() => expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "false"));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
  });

  it("the trigger wrapper doesn't affect layout (display: contents)", () => {
    const { container } = render(<LazyAddExpenseDialog><button>Add</button></LazyAddExpenseDialog>);
    expect(container.firstElementChild).toHaveClass("contents");
  });
});

describe("preloading", () => {
  it("can warm the chunk on demand (used when the user hovers the trigger and when the browser is idle)", async () => {
    expect(() => preloadAddExpenseDialog()).not.toThrow();
  });
});
