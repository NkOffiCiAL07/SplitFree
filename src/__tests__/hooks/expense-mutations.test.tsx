import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createHarness, stubFetch, callOf } from "./harness";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useCreateExpense, useUpdateExpense, useDeleteExpense, useDuplicateExpense } from "@/hooks/use-expenses";
import type { Expense } from "@/types";

beforeEach(() => vi.clearAllMocks());

const expense = {
  id: "e1", groupId: "g1", description: "Dinner", amount: 30000, currency: "INR", category: "FOOD", splitType: "EQUAL",
  paidById: "a", date: "2026-03-01", isRecurring: false, recurringInterval: null, notes: null,
  splits: [{ userId: "a", amount: 15000 }, { userId: "b", amount: 15000 }],
} as unknown as Expense;

const refreshed = (invalidated: () => unknown[][]) => invalidated().map((k) => k[0]);

describe("useCreateExpense", () => {
  it("POSTs the expense, refreshes every screen that shows money, and confirms", async () => {
    const fetchMock = stubFetch({ data: { id: "new", groupId: "g1" } });
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => useCreateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "x" }); });
    expect(callOf(fetchMock)).toEqual({ url: "/api/expenses", method: "POST", body: { description: "x", clientId: expect.any(String) } }); // clientId makes a retry idempotent
    expect(refreshed(invalidated)).toEqual(expect.arrayContaining(["expenses", "dashboard", "analytics", "balance"]));
    expect(invalidated()).toContainEqual(["groups", "g1"]);
    expect(toast.success).toHaveBeenCalledWith("Expense added");
  });

  it("reports failures", async () => {
    stubFetch({ error: { message: "Not a member of this group" } });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useCreateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({}).catch(() => {}); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not a member of this group"));
  });
});

describe("useUpdateExpense", () => {
  it("PATCHes by id without sending the id in the body, and refreshes that expense and its history", async () => {
    const fetchMock = stubFetch({ data: { id: "e1", groupId: "g1" } });
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => useUpdateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "e1", description: "New" }); });
    expect(callOf(fetchMock)).toEqual({ url: "/api/expenses/e1", method: "PATCH", body: { description: "New" } });
    expect(invalidated()).toContainEqual(["expenses", "e1"]);
    expect(invalidated()).toContainEqual(["groups", "g1"]);
    expect(toast.success).toHaveBeenCalledWith("Expense updated");
  });
});

describe("useDeleteExpense", () => {
  it("deleting by id works but offers no undo (nothing to restore from)", async () => {
    const fetchMock = stubFetch({ data: { deleted: true } });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync("e1"); });
    expect(callOf(fetchMock)).toEqual({ url: "/api/expenses/e1", method: "DELETE", body: undefined });
    expect(toast.success).toHaveBeenCalledWith("Expense deleted");
    expect(toast.success.mock.calls[0]).toHaveLength(1); // no options → no Undo action
  });

  it("deleting a whole expense shows an Undo that re-creates it with the same splits", async () => {
    const fetchMock = stubFetch({ data: {} });
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync(expense); });

    expect(callOf(fetchMock).url).toBe("/api/expenses/e1");
    const [message, options] = toast.success.mock.calls[0];
    expect(message).toBe("Expense deleted");
    expect(options.duration).toBe(8000);
    expect(options.action.label).toBe("Undo");

    await act(async () => { await options.action.onClick(); });
    const restore = callOf(fetchMock, 1);
    expect(restore).toMatchObject({ url: "/api/expenses", method: "POST" });
    expect(restore.body).toMatchObject({ description: "Dinner", amount: 300, currency: "INR", groupId: "g1", paidById: "a", participants: ["a", "b"] });
    expect(toast.success).toHaveBeenLastCalledWith("Expense restored");
    expect(invalidated()).toContainEqual(["budget", "g1"]);
  });

  it("tells the user when Undo itself fails", async () => {
    const fetchMock = stubFetch({ data: {} });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync(expense); });
    const { action } = toast.success.mock.calls[0][1];
    fetchMock.mockImplementation((async () => ({ ok: true, json: async () => ({ error: { message: "This group is archived" } }) })) as never);
    await act(async () => { await action.onClick(); });
    expect(toast.error).toHaveBeenCalledWith("This group is archived");
  });

  it("shows the error and no undo when the delete fails", async () => {
    stubFetch({ error: { message: "Only the payer can delete this expense" } });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useDeleteExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync(expense).catch(() => {}); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only the payer can delete this expense"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useDuplicateExpense", () => {
  it("creates a copy dated today, not recurring, keeping the split", async () => {
    const fetchMock = stubFetch({ data: { id: "copy", groupId: "g1" } });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useDuplicateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ ...expense, isRecurring: true }); });
    const { body } = callOf(fetchMock) as { body: Record<string, unknown> };
    expect(body).toMatchObject({ description: "Dinner (copy)", isRecurring: false, amount: 300, participants: ["a", "b"] });
    expect(new Date(body.date as string).toDateString()).toBe(new Date().toDateString());
    expect(toast.success).toHaveBeenCalledWith("Expense duplicated");
  });
});
