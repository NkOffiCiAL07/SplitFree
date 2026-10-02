import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const loads = vi.hoisted(() => vi.fn());

import { lazyControlledDialog } from "@/components/shared/lazy-dialog";

function Heavy({ open, label }: { open?: boolean; label?: string }) {
  return <div data-testid="heavy" data-open={String(open)}>{label}</div>;
}
const Lazy = lazyControlledDialog<{ open?: boolean; label?: string }>(async () => { loads(); return Heavy; });

describe("lazyControlledDialog", () => {
  it("renders nothing, and fetches nothing, while the dialog has never been opened", () => {
    render(<Lazy open={false} label="x" />);
    expect(screen.queryByTestId("heavy")).not.toBeInTheDocument();
    expect(loads).not.toHaveBeenCalled();
  });

  it("mounts the real dialog with all its props the first time it opens", async () => {
    const { rerender } = render(<Lazy open={false} label="Create" />);
    rerender(<Lazy open label="Create" />);
    const el = await screen.findByTestId("heavy");
    expect(el).toHaveAttribute("data-open", "true");
    expect(el).toHaveTextContent("Create");
    expect(loads).toHaveBeenCalledTimes(1);
  });

  it("stays mounted after closing so its close animation can play", async () => {
    const { rerender } = render(<Lazy open label="x" />);
    await screen.findByTestId("heavy");
    rerender(<Lazy open={false} label="x" />);
    expect(screen.getByTestId("heavy")).toHaveAttribute("data-open", "false");
  });

  it("doesn't reload the code when reopened", async () => {
    const { rerender } = render(<Lazy open label="x" />);
    await screen.findByTestId("heavy");
    rerender(<Lazy open={false} label="x" />);
    rerender(<Lazy open label="x" />);
    expect(loads).toHaveBeenCalledTimes(1);
  });
});
