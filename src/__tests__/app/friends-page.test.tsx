import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  friends: { data: [] as unknown[], isLoading: false },
  groups: { data: [] as unknown[] },
  pending: { data: [] as unknown[] },
  sent: { data: [] as unknown[] },
  balances: { data: undefined as unknown },
  addFriend: vi.fn(), removeFriend: vi.fn(), respond: vi.fn(), cancel: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "me", email: "me@x.com", user_metadata: { name: "Nishant Kumar" } } }) }));
vi.mock("@/hooks/use-groups", () => ({ useGroups: () => h.groups }));
vi.mock("@/hooks/use-balances", () => ({ useBalances: () => h.balances }));
vi.mock("@/hooks/use-friends", () => ({
  useFriends: () => h.friends,
  usePendingFriendRequests: () => h.pending,
  useSentFriendRequests: () => h.sent,
  useAddFriend: () => ({ mutateAsync: h.addFriend, isPending: false }),
  useRemoveFriend: () => ({ mutate: h.removeFriend }),
  useRespondToFriendRequest: () => ({ mutate: h.respond, isPending: false }),
  useCancelFriendRequest: () => ({ mutate: h.cancel }),
}));
vi.mock("@/components/expenses/add-expense-dialog", () => ({
  AddExpenseDialog: ({ open, members }: { open?: boolean; members?: { userId: string }[] }) => (open ? <div data-testid="add-expense" data-members={members?.map((m) => m.userId).join(",")} /> : null),
}));

import FriendsPage from "@/app/(dashboard)/friends/page";

const friendship = (id: string, name: string, email: string) => ({ id: `f-${id}`, friendId: id, createdAt: new Date().toISOString(), friend: { name, email, avatarUrl: null } });

beforeEach(() => {
  vi.clearAllMocks();
  h.addFriend.mockResolvedValue({});
  h.friends.data = []; h.friends.isLoading = false;
  h.groups.data = []; h.pending.data = []; h.sent.data = []; h.balances.data = undefined;
});

describe("FriendsPage — friends list", () => {
  it("shows an empty state that invites you to add your first friend", () => {
    render(<FriendsPage />);
    expect(screen.getByText(/add friends by email/i)).toBeInTheDocument();
  });

  it("lists friends with a link to their detail page and a count", () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com"), friendship("b", "Bhanu Pal", "bhanu@x.com")];
    render(<FriendsPage />);
    expect(screen.getByText("Friends (2)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Asha Rao" })).toHaveAttribute("href", "/friends/a");
    expect(screen.getByText("asha@x.com")).toBeInTheDocument();
  });

  it("shows each friend's balance in every currency (lent in green, owes in red), in rupee style", () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com")];
    h.balances.data = { byPerson: { a: { all: [{ currency: "INR", net: 123456 }, { currency: "USD", net: -2000 }] } } };
    render(<FriendsPage />);
    expect(screen.getByText("lent ₹1.2K")).toBeInTheDocument();
    expect(screen.getByText("owes $20.00")).toBeInTheDocument();
  });

  it("removes a friend", async () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com")];
    const { container } = render(<FriendsPage />);
    await userEvent.click(container.querySelector("button.hover\\:text-destructive") as HTMLElement);
    expect(h.removeFriend).toHaveBeenCalledWith("a");
  });

  it("Add expense opens the dialog with just you and that friend", async () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com")];
    render(<FriendsPage />);
    await userEvent.click(screen.getByRole("button", { name: /add expense/i }));
    expect(screen.getByTestId("add-expense")).toHaveAttribute("data-members", "me,a");
  });
});

describe("FriendsPage — adding friends", () => {
  it("sends a friend request by email and closes the dialog", async () => {
    render(<FriendsPage />);
    await userEvent.click(screen.getByRole("button", { name: /add friend/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByPlaceholderText("friend@example.com"), "asha@x.com");
    await userEvent.click(within(dialog).getByRole("button", { name: /send friend request/i }));
    await waitFor(() => expect(h.addFriend).toHaveBeenCalledWith("asha@x.com"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ignores an empty email", async () => {
    render(<FriendsPage />);
    await userEvent.click(screen.getByRole("button", { name: /add friend/i }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /send friend request/i }));
    expect(h.addFriend).not.toHaveBeenCalled();
  });

  it("Invite opens WhatsApp with a ready message (link built on click)", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<FriendsPage />);
    await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("Nishant Kumar invited you to");
    expect(text).toContain(`${window.location.origin}/signup`);
    expect(open.mock.calls[0][1]).toBe("_blank");
  });
});

describe("FriendsPage — requests", () => {
  it("accepts or declines received requests", async () => {
    h.pending.data = [{ id: "r1", userId: "u9", user: { name: "Chitra", email: "c@x.com", avatarUrl: null } }];
    render(<FriendsPage />);
    expect(screen.getByText("Received requests")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(h.respond).toHaveBeenCalledWith({ requesterId: "u9", action: "accept" });
    await userEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(h.respond).toHaveBeenLastCalledWith({ requesterId: "u9", action: "decline" });
  });

  it("lets you cancel requests you sent", async () => {
    h.sent.data = [{ id: "s1", friendId: "u7", friend: { name: "Dev", email: "d@x.com", avatarUrl: null } }];
    render(<FriendsPage />);
    expect(screen.getByText("Dev")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(h.cancel).toHaveBeenCalledWith("u7");
  });

  it("hides both sections when there are no requests", () => {
    render(<FriendsPage />);
    expect(screen.queryByText("Received requests")).not.toBeInTheDocument();
  });
});

describe("FriendsPage — people from your groups", () => {
  const group = (name: string, members: { userId: string; name: string }[]) => ({ id: name, name, members: members.map((m) => ({ userId: m.userId, user: { name: m.name, avatarUrl: null } })) });

  it("lists group-mates who aren't friends yet, once, with the group they're from", () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com")];
    h.groups.data = [
      group("Goa Trip", [{ userId: "me", name: "Me" }, { userId: "a", name: "Asha Rao" }, { userId: "k", name: "Kartik" }]),
      group("Flat", [{ userId: "k", name: "Kartik" }, { userId: "d", name: "Divyansh" }]),
    ];
    render(<FriendsPage />);
    expect(screen.getByText("From your groups")).toBeInTheDocument();
    expect(screen.getAllByText("Kartik")).toHaveLength(1); // de-duplicated across groups
    expect(screen.getByText("via Goa Trip")).toBeInTheDocument();
    expect(screen.getByText("Divyansh")).toBeInTheDocument();
    expect(screen.queryByText("via Goa Trip", { selector: "[data-friend]" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kartik" })).toHaveAttribute("href", "/friends/k");
  });

  it("doesn't list you or existing friends as group-mates", () => {
    h.friends.data = [friendship("a", "Asha Rao", "asha@x.com")];
    h.groups.data = [group("Goa", [{ userId: "me", name: "Me" }, { userId: "a", name: "Asha Rao" }])];
    render(<FriendsPage />);
    expect(screen.queryByText("From your groups")).not.toBeInTheDocument();
  });
});
