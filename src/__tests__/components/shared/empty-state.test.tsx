import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Users}
        title="No groups yet"
        description="Create a group to get started"
      />
    );
    expect(screen.getByText("No groups yet")).toBeInTheDocument();
    expect(screen.getByText("Create a group to get started")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Users}
        title="Empty"
        description="Nothing here"
        action={{ label: "Create group", onClick }}
      />
    );
    expect(screen.getByRole("button", { name: "Create group" })).toBeInTheDocument();
  });

  it("does not render button when action is omitted", () => {
    render(<EmptyState icon={Users} title="Empty" description="Nothing here" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClick when action button is clicked", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Users}
        title="Empty"
        description="Nothing here"
        action={{ label: "Go", onClick }}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies custom className", () => {
    const { container } = render(
      <EmptyState
        icon={Users}
        title="T"
        description="D"
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
