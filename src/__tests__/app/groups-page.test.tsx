import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useGroups = vi.fn();
vi.mock("@/hooks/use-groups", () => ({ useGroups: (archived: boolean) => useGroups(archived) }));
vi.mock("@/hooks/use-balances", () => ({ useBalances: () => ({ data: undefined }) }));
vi.mock("@/components/groups/create-group-dialog", () => ({ CreateGroupDialog: () => <div data-testid="create" /> }));
vi.mock("@/components/groups/group-card", () => ({ GroupCard: ({ group }: { group: { name: string } }) => <div>{group.name}</div> }));

import GroupsPage from "@/app/(dashboard)/groups/page";

const g = (name: string) => ({ id: name, name, category: "TRIP", members: [], _count: { members: 1, expenses: 0 } });

beforeEach(() => useGroups.mockReset());

describe("GroupsPage — active vs archived", () => {
  it("lists active groups first, then archived ones when the tab is switched", async () => {
    useGroups.mockImplementation((archived: boolean) => ({ data: archived ? [g("Old Trip")] : [g("Goa 2026")], isLoading: false }));
    render(<GroupsPage />);
    expect(useGroups).toHaveBeenCalledWith(false);
    expect(screen.getByText("Goa 2026")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(useGroups).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Old Trip")).toBeInTheDocument();
    expect(screen.queryByText("Goa 2026")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archived" })).toHaveAttribute("aria-selected", "true");
  });

  it("can switch back to active groups", async () => {
    useGroups.mockImplementation((archived: boolean) => ({ data: archived ? [] : [g("Flat")], isLoading: false }));
    render(<GroupsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Archived" }));
    await userEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(screen.getByText("Flat")).toBeInTheDocument();
  });
});
