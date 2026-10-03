import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { createHarness } from "../hooks/harness";

const { toast, store } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  store: new Map<string, string>(),
}));
vi.hoisted(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
  });
});
vi.mock("sonner", () => ({ toast }));

import { OfflineStatus } from "@/components/layout/offline-status";
import { PendingSyncList } from "@/components/expenses/pending-sync-list";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useSettleUp } from "@/hooks/use-settlements";
import { setOutboxUser, enqueue, pendingItems, clearOutbox } from "@/lib/offline/outbox";

let online = true;
const goOnline = () => { online = true; window.dispatchEvent(new Event("online")); };
const goOffline = () => { online = false; window.dispatchEvent(new Event("offline")); };
const queued = (id: string, over = {}) => enqueue({ id, kind: "expense", url: "/api/expenses", body: { description: id }, label: id, amount: 250, currency: "INR", ...over });

beforeEach(() => {
  online = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  clearOutbox(); setOutboxUser("u1");
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OfflineStatus banner", () => {
  it("is invisible when online with nothing waiting", () => {
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("tells the user they're offline, and what they can still do", () => {
    online = false;
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    expect(screen.getByRole("status")).toHaveTextContent(/offline.*last saved data.*add expenses and payments/i);
  });

  it("appears and disappears as the connection changes", () => {
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    act(() => goOffline());
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => goOnline());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offline with saved changes: shows how many will sync", () => {
    queued("a"); queued("b");
    online = false;
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    expect(screen.getByRole("status")).toHaveTextContent("2 changes are saved and will sync automatically");
  });

  it("when the connection returns it syncs the queue, refreshes the screens, and confirms", async () => {
    queued("a");
    online = false;
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", f);
    const { wrapper, invalidated } = createHarness();
    render(<OfflineStatus />, { wrapper });
    expect(f).not.toHaveBeenCalled(); // nothing is sent while offline
    act(() => goOnline());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Your offline change is synced"));
    expect(JSON.parse(f.mock.calls[0][1].body).clientId).toBe("a");
    expect(pendingItems()).toEqual([]);
    expect(invalidated()).toEqual(expect.arrayContaining([["expenses"], ["dashboard"], ["balance"], ["balances"]]));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("opening the app online with unsent changes (e.g. after a crash) syncs them straight away", async () => {
    queued("a"); queued("b");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }));
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 offline changes synced"));
  });

  it("tells the user when the server rejected something, instead of dropping it silently", async () => {
    queued("a", { label: "Trip dinner", amount: 100 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: { message: "This group is archived" } }) }));
    const { wrapper } = createHarness();
    render(<OfflineStatus />, { wrapper });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Trip dinner.*₹100.*This group is archived/)));
  });
});

describe("PendingSyncList", () => {
  it("renders nothing when nothing is waiting", () => {
    const { container } = render(<PendingSyncList />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists expenses and payments waiting to sync with their amounts", () => {
    queued("Dinner", { label: "Dinner", amount: 450 });
    queued("p1", { kind: "settlement", label: "Payment", amount: 100, url: "/api/settlements" });
    render(<PendingSyncList />);
    const section = screen.getByRole("region", { name: "Waiting to sync" });
    expect(section).toHaveTextContent("Waiting to sync (2)");
    expect(section).toHaveTextContent("Dinner");
    expect(section).toHaveTextContent("₹450.00");
    expect(section).toHaveTextContent("payment");
  });

  it("updates live as items sync", () => {
    queued("a");
    render(<PendingSyncList />);
    expect(screen.getByRole("region")).toBeInTheDocument();
    act(() => clearOutbox());
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});

describe("offline writes through the real hooks", () => {
  it("adding an expense offline saves it on the device and tells the user (no error, no server call)", async () => {
    online = false;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { wrapper, invalidated } = createHarness();
    const { result } = renderHook(() => useCreateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "Cab", amount: 180, currency: "INR" }); });
    expect(f).not.toHaveBeenCalled();
    expect(pendingItems()).toHaveLength(1);
    expect(pendingItems()[0]).toMatchObject({ kind: "expense", label: "Cab", amount: 180, url: "/api/expenses" });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/saved on this device/i));
    expect(toast.error).not.toHaveBeenCalled();
    expect(invalidated()).toEqual([]); // nothing to refresh yet
  });

  it("recording a payment offline is queued too", async () => {
    online = false;
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSettleUp(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ toUserId: "u2", amount: 75, currency: "INR", note: "UPI" }); });
    expect(pendingItems()[0]).toMatchObject({ kind: "settlement", label: "UPI", amount: 75, url: "/api/settlements" });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Payment saved on this device/));
  });

  it("a server error is still an error, not a queued write", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Not a member of this group" } }) }));
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useCreateExpense(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "x" }).catch(() => {}); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not a member of this group"));
    expect(pendingItems()).toEqual([]);
  });
});
