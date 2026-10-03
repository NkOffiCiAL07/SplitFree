import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createHarness, stubFetch, callOf } from "./harness";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useCreateGroup, useUpdateGroup, useArchiveGroup, useDeleteGroup, useAddMember, useRemoveMember, useLeaveGroup, useTransferOwnership } from "@/hooks/use-groups";
import { useAddComment, useDeleteComment } from "@/hooks/use-comments";
import { useSetBudget, useDeleteBudget } from "@/hooks/use-budget";
import { useAddFriend, useRemoveFriend, useCancelFriendRequest, useRespondToFriendRequest } from "@/hooks/use-friends";
import { useSettleUp, useSendReminder } from "@/hooks/use-settlements";

beforeEach(() => vi.clearAllMocks());

interface Case {
  name: string;
  hook: () => { mutate: (v: never) => void; mutateAsync: (v: never) => Promise<unknown> };
  input: unknown;
  reply?: { data?: unknown };
  request: { url: string; method: string; body?: unknown };
  invalidates: unknown[][];
  toast?: string;
}

const cases: Case[] = [
  { name: "createGroup", hook: useCreateGroup as never, input: { name: "Goa" }, reply: { data: { name: "Goa" } },
    request: { url: "/api/groups", method: "POST", body: { name: "Goa" } }, invalidates: [["groups"]], toast: 'Group "Goa" created' },
  { name: "updateGroup", hook: useUpdateGroup as never, input: { id: "g1", name: "New" }, reply: { data: { id: "g1" } },
    request: { url: "/api/groups/g1", method: "PATCH", body: { name: "New" } }, invalidates: [["groups"], ["groups", "g1"]], toast: "Group updated" },
  { name: "archiveGroup", hook: useArchiveGroup as never, input: { id: "g1", archived: true },
    request: { url: "/api/groups/g1/archive", method: "POST", body: { archived: true } }, invalidates: [["groups"], ["dashboard"]], toast: "Group archived" },
  { name: "restoreGroup", hook: useArchiveGroup as never, input: { id: "g1", archived: false },
    request: { url: "/api/groups/g1/archive", method: "POST", body: { archived: false } }, invalidates: [["groups"], ["dashboard"]], toast: "Group restored" },
  { name: "deleteGroup", hook: useDeleteGroup as never, input: "g1",
    request: { url: "/api/groups/g1", method: "DELETE" }, invalidates: [["groups"]], toast: "Group deleted" },
  { name: "addMember", hook: useAddMember as never, input: { groupId: "g1", email: "a@x.com" }, reply: { data: { id: "m" } },
    request: { url: "/api/groups/g1/members", method: "POST", body: { email: "a@x.com" } }, invalidates: [["groups", "g1"]], toast: "Member added" },
  { name: "addMember (invite)", hook: useAddMember as never, input: { groupId: "g1", email: "new@x.com" }, reply: { data: { invited: true, email: "new@x.com" } },
    request: { url: "/api/groups/g1/members", method: "POST", body: { email: "new@x.com" } }, invalidates: [["groups", "g1"]], toast: "Invite sent to new@x.com" },
  { name: "removeMember", hook: useRemoveMember as never, input: { groupId: "g1", userId: "u2" },
    request: { url: "/api/groups/g1/members", method: "DELETE", body: { userId: "u2" } }, invalidates: [["groups", "g1"]], toast: "Member removed" },
  { name: "leaveGroup", hook: useLeaveGroup as never, input: { groupId: "g1", userId: "me" },
    request: { url: "/api/groups/g1/members", method: "DELETE", body: { userId: "me" } }, invalidates: [["groups"]], toast: "Left the group" },
  { name: "transferOwnership", hook: useTransferOwnership as never, input: { groupId: "g1", userId: "u2" },
    request: { url: "/api/groups/g1/members", method: "PATCH", body: { userId: "u2", role: "ADMIN" } }, invalidates: [["groups", "g1"]], toast: "Ownership transferred" },

  { name: "addComment", hook: (() => useAddComment("e1")) as never, input: "nice",
    request: { url: "/api/expenses/e1/comments", method: "POST", body: { text: "nice" } }, invalidates: [["comments", "e1"]] },
  { name: "deleteComment", hook: (() => useDeleteComment("e1")) as never, input: "c1",
    request: { url: "/api/expenses/e1/comments", method: "DELETE", body: { commentId: "c1" } }, invalidates: [["comments", "e1"]] },

  { name: "setBudget", hook: (() => useSetBudget("g1")) as never, input: { amount: 500, category: "FOOD", period: "MONTHLY" },
    request: { url: "/api/groups/g1/budget", method: "POST", body: { amount: 500, category: "FOOD", period: "MONTHLY" } }, invalidates: [["budget", "g1"]], toast: "Budget saved" },
  { name: "deleteBudget", hook: (() => useDeleteBudget("g1")) as never, input: "b1",
    request: { url: "/api/groups/g1/budget", method: "DELETE", body: { budgetId: "b1" } }, invalidates: [["budget", "g1"]], toast: "Budget removed" },

  { name: "addFriend", hook: useAddFriend as never, input: "a@x.com",
    request: { url: "/api/friends", method: "POST", body: { email: "a@x.com" } }, invalidates: [["friends"]], toast: "Friend added!" },
  { name: "removeFriend", hook: useRemoveFriend as never, input: "u2",
    request: { url: "/api/friends", method: "DELETE", body: { friendId: "u2" } }, invalidates: [["friends"]], toast: "Friend removed" },
  { name: "cancelFriendRequest", hook: useCancelFriendRequest as never, input: "u2",
    request: { url: "/api/friends", method: "DELETE", body: { friendId: "u2" } }, invalidates: [["friends", "sent"]], toast: "Request cancelled" },
  { name: "acceptFriend", hook: useRespondToFriendRequest as never, input: { requesterId: "u2", action: "accept" },
    request: { url: "/api/friends", method: "POST", body: { action: "accept", requesterId: "u2" } }, invalidates: [["friends"]], toast: "Friend request accepted!" },
  { name: "declineFriend", hook: useRespondToFriendRequest as never, input: { requesterId: "u2", action: "decline" },
    request: { url: "/api/friends", method: "POST", body: { action: "decline", requesterId: "u2" } }, invalidates: [["friends"]], toast: "Request declined" },

  { name: "settleUp", hook: useSettleUp as never, input: { toUserId: "u2", amount: 50, currency: "INR", groupId: "g1" },
    request: { url: "/api/settlements", method: "POST", body: { toUserId: "u2", amount: 50, currency: "INR", groupId: "g1", clientId: expect.any(String) } },
    invalidates: [["settlements"], ["expenses"], ["balance"], ["balances"], ["friends"], ["groups"], ["dashboard"], ["analytics"]], toast: "Payment recorded!" },
  { name: "sendReminder", hook: useSendReminder as never, input: { debtorId: "u2", amount: 5000, currency: "INR" },
    request: { url: "/api/settlements/remind", method: "POST", body: { debtorId: "u2", amount: 5000, currency: "INR" } }, invalidates: [], toast: "Reminder sent" },
];

describe.each(cases)("$name", (c) => {
  it("sends the right request, refreshes the right caches, and tells the user", async () => {
    const fetchMock = stubFetch(c.reply ?? { data: {} });
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => c.hook(), { wrapper });
    await act(async () => { await result.current.mutateAsync(c.input as never); });

    expect(callOf(fetchMock)).toEqual({ url: c.request.url, method: c.request.method, body: c.request.body });
    for (const key of c.invalidates) expect(invalidated()).toContainEqual(key);
    if (c.toast) expect(toast.success).toHaveBeenCalledWith(c.toast);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the server's error message and doesn't refresh caches when the request fails", async () => {
    stubFetch({ error: { message: "Nope, not allowed" } });
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => c.hook(), { wrapper });
    await act(async () => { await result.current.mutateAsync(c.input as never).catch(() => {}); });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope, not allowed"));
    expect(invalidated()).toEqual([]);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
