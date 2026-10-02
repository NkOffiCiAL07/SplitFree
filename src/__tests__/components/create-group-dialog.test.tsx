import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ create: vi.fn(), friends: { data: [] as unknown[] }, home: { value: "INR" } }));
vi.mock("@/hooks/use-groups", () => ({ useCreateGroup: () => ({ mutateAsync: h.create, isPending: false }) }));
vi.mock("@/hooks/use-friends", () => ({ useFriendContacts: () => h.friends }));
vi.mock("@/hooks/use-profile", () => ({ useUserCurrency: () => h.home.value }));

import { CreateGroupDialog } from "@/components/groups/create-group-dialog";

const friend = (id: string, name: string, email: string) => ({ friendId: id, friend: { name, email, avatarUrl: null } });

beforeEach(() => {
  vi.clearAllMocks();
  h.create.mockResolvedValue({ id: "g1", name: "Goa" });
  h.friends.data = [];
  h.home.value = "INR";
});

const renderOpen = (onOpenChange = vi.fn()) => render(<CreateGroupDialog open onOpenChange={onOpenChange} />);
const submit = () => userEvent.click(screen.getByRole("button", { name: /^create group$/i }));

describe("CreateGroupDialog", () => {
  it("requires a group name", async () => {
    renderOpen();
    await submit();
    expect(await screen.findByText(/group name is required/i)).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("creates a group with INR and 'Other' by default, then closes", async () => {
    const onOpenChange = vi.fn();
    renderOpen(onOpenChange);
    await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Goa Trip");
    await submit();
    await waitFor(() => expect(h.create).toHaveBeenCalled());
    const sent = h.create.mock.calls[0][0];
    expect(sent).toMatchObject({ name: "Goa Trip", category: "OTHER", currency: "INR" });
    expect(sent.memberEmails).toBeUndefined();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends the optional description", async () => {
    renderOpen();
    await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Flat");
    await userEvent.type(screen.getByPlaceholderText(/add a description/i), "Monthly bills");
    await submit();
    await waitFor(() => expect(h.create.mock.calls[0][0].description).toBe("Monthly bills"));
  });

  it("lists currencies with INR first (India-first) and lets you choose another", async () => {
    renderOpen();
    const currency = screen.getAllByRole("combobox")[1];
    expect(currency).toHaveTextContent("INR");
    await userEvent.click(currency);
    const options = within(await screen.findByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["INR", "USD", "EUR", "GBP", "CAD", "AUD", "JPY"]);
    await userEvent.click(screen.getByRole("option", { name: "USD" }));
    await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "US Trip");
    await submit();
    await waitFor(() => expect(h.create.mock.calls[0][0].currency).toBe("USD"));
  });

  describe("home currency (Settings → Home currency)", () => {
    it("new groups start in the user's home currency, not a hardcoded one", async () => {
      h.home.value = "USD";
      renderOpen();
      expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("USD");
      await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "NYC");
      await submit();
      await waitFor(() => expect(h.create.mock.calls[0][0].currency).toBe("USD"));
    });

    it("can still be changed for this one group", async () => {
      h.home.value = "USD";
      renderOpen();
      await userEvent.click(screen.getAllByRole("combobox")[1]);
      await userEvent.click(await screen.findByRole("option", { name: "EUR" }));
      await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Paris");
      await submit();
      await waitFor(() => expect(h.create.mock.calls[0][0].currency).toBe("EUR"));
    });

    it("follows the home currency when the profile loads after the dialog opens", async () => {
      const { rerender } = renderOpen();
      expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("INR");
      h.home.value = "GBP";
      rerender(<CreateGroupDialog open onOpenChange={vi.fn()} />);
      await waitFor(() => expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("GBP"));
    });

    it("after creating a group the form goes back to the home currency (not INR)", async () => {
      h.home.value = "AUD";
      renderOpen();
      await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Sydney");
      await submit();
      await waitFor(() => expect(h.create).toHaveBeenCalled());
      expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("AUD");
    });
  });

  it("lets you pick a category", async () => {
    renderOpen();
    await userEvent.click(screen.getAllByRole("combobox")[0]);
    await userEvent.click(await screen.findByRole("option", { name: /trip/i }));
    await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Manali");
    await submit();
    await waitFor(() => expect(h.create.mock.calls[0][0].category).toBe("TRIP"));
  });

  describe("adding members from friends and group-mates", () => {
    beforeEach(() => {
      h.friends.data = [friend("a", "Asha Rao", "asha@x.com"), friend("b", "Bhanu Pal", "bhanu@x.com")];
    });

    it("shows the picker only when there are people to pick", () => {
      h.friends.data = [];
      const { unmount } = renderOpen();
      expect(screen.queryByText(/add members/i)).not.toBeInTheDocument();
      unmount();
      h.friends.data = [friend("a", "Asha", "a@x.com")];
      renderOpen();
      expect(screen.getByText(/add members/i)).toBeInTheDocument();
    });

    it("sends the emails of everyone selected", async () => {
      renderOpen();
      await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Goa");
      await userEvent.click(screen.getByRole("button", { name: /asha rao/i }));
      await userEvent.click(screen.getByRole("button", { name: /bhanu pal/i }));
      await submit();
      await waitFor(() => expect(h.create).toHaveBeenCalled());
      expect(h.create.mock.calls[0][0].memberEmails).toEqual(["asha@x.com", "bhanu@x.com"]);
    });

    it("tapping a selected person again removes them", async () => {
      renderOpen();
      await userEvent.type(screen.getByPlaceholderText(/weekend trip/i), "Goa");
      await userEvent.click(screen.getByRole("button", { name: /asha rao/i }));
      await userEvent.click(screen.getByRole("button", { name: /bhanu pal/i }));
      await userEvent.click(screen.getByRole("button", { name: /asha rao/i }));
      await submit();
      await waitFor(() => expect(h.create).toHaveBeenCalled());
      expect(h.create.mock.calls[0][0].memberEmails).toEqual(["bhanu@x.com"]);
    });
  });

  it("Cancel closes without creating anything", async () => {
    const onOpenChange = vi.fn();
    renderOpen(onOpenChange);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("uncontrolled: shows a 'New Group' trigger that opens the dialog", async () => {
    render(<CreateGroupDialog />);
    expect(screen.queryByText("Create a group")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /new group/i }));
    expect(await screen.findByText("Create a group")).toBeInTheDocument();
  });
});
