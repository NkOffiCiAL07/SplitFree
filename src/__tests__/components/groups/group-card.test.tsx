import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupCard } from "@/components/groups/group-card";
import type { Group } from "@/types";

const baseGroup: Group = {
  id: "group-1",
  name: "Beach Trip",
  description: "Fun in the sun",
  imageUrl: null,
  category: "TRIP",
  currency: "USD",
  createdById: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
  members: [
    {
      id: "m1",
      groupId: "group-1",
      userId: "user-1",
      role: "ADMIN",
      joinedAt: new Date("2024-01-01"),
      user: { id: "user-1", name: "Alice", email: "alice@example.com", avatarUrl: null, currency: "USD", timezone: "UTC", createdAt: new Date() },
    },
    {
      id: "m2",
      groupId: "group-1",
      userId: "user-2",
      role: "MEMBER",
      joinedAt: new Date("2024-01-02"),
      user: { id: "user-2", name: "Bob", email: "bob@example.com", avatarUrl: null, currency: "USD", timezone: "UTC", createdAt: new Date() },
    },
  ],
  _count: { expenses: 5, members: 2 },
};

describe("GroupCard", () => {
  it("renders the group name", () => {
    render(<GroupCard group={baseGroup} />);
    expect(screen.getByText("Beach Trip")).toBeInTheDocument();
  });

  it("renders the group description", () => {
    render(<GroupCard group={baseGroup} />);
    expect(screen.getByText("Fun in the sun")).toBeInTheDocument();
  });

  it("renders the currency badge", () => {
    render(<GroupCard group={baseGroup} />);
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders expense and member counts", () => {
    render(<GroupCard group={baseGroup} />);
    expect(screen.getByText("2")).toBeInTheDocument(); // members
    expect(screen.getByText("5")).toBeInTheDocument(); // expenses
  });

  it("links to the correct group page", () => {
    render(<GroupCard group={baseGroup} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/groups/group-1");
  });

  it("shows balance when user is owed money", () => {
    render(<GroupCard group={baseGroup} balance={{ net: 5000, currency: "USD" }} />);
    expect(screen.getByText(/you're owed/i)).toBeInTheDocument();
  });

  it("shows balance when user owes money", () => {
    render(<GroupCard group={baseGroup} balance={{ net: -5000, currency: "USD" }} />);
    expect(screen.getByText(/you owe/i)).toBeInTheDocument();
  });

  it("hides balance display when net is 0", () => {
    render(<GroupCard group={baseGroup} balance={{ net: 0, currency: "USD" }} />);
    expect(screen.queryByText(/you owe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you're owed/i)).not.toBeInTheDocument();
  });

  it("hides balance display when balance prop is absent", () => {
    render(<GroupCard group={baseGroup} />);
    expect(screen.queryByText(/you owe/i)).not.toBeInTheDocument();
  });

  it("renders the category emoji for TRIP", () => {
    const { container } = render(<GroupCard group={baseGroup} />);
    expect(container.textContent).toContain("✈️");
  });

  it("renders without description when not provided", () => {
    const group = { ...baseGroup, description: null };
    render(<GroupCard group={group} />);
    expect(screen.getByText("Beach Trip")).toBeInTheDocument();
  });

  it("renders +N indicator when members exceed 5", () => {
    const manyMembers = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`,
      groupId: "group-1",
      userId: `user-${i}`,
      role: "MEMBER" as const,
      joinedAt: new Date(),
      user: { id: `user-${i}`, name: `User ${i}`, email: `u${i}@test.com`, avatarUrl: null, currency: "USD" as const, timezone: "UTC", createdAt: new Date() },
    }));
    render(<GroupCard group={{ ...baseGroup, members: manyMembers }} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
