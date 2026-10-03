import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postOrQueue, isQueued, resetAttempts } from "@/lib/offline/queued-write";
import { setOutboxUser, pendingItems, clearOutbox } from "@/lib/offline/outbox";
import { OfflineError } from "@/lib/api-client";

const meta = { kind: "expense" as const, label: "Dinner", amount: 250, currency: "INR" };
const setOnline = (v: boolean) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);

beforeEach(() => { clearOutbox(); setOutboxUser("u1"); setOnline(true); resetAttempts(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("postOrQueue", () => {
  it("online: sends the write with a clientId and returns the server's result", async () => {
    const f = vi.fn().mockResolvedValue({ json: async () => ({ data: { id: "e1" } }) });
    vi.stubGlobal("fetch", f);
    const r = await postOrQueue("/api/expenses", { description: "Dinner" }, meta);
    expect(r).toEqual({ id: "e1" });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ description: "Dinner", clientId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(pendingItems()).toEqual([]);
  });

  it("offline: queues it and says so — and the queued id is the same clientId a retry will send", async () => {
    setOnline(false);
    const r = await postOrQueue("/api/expenses", { description: "Dinner", amount: 250 }, meta);
    expect(isQueued(r)).toBe(true);
    const [queued] = pendingItems();
    expect(queued).toMatchObject({ id: (r as { id: string }).id, label: "Dinner", amount: 250, url: "/api/expenses", body: { description: "Dinner", amount: 250 } });
  });

  it("a connection that drops mid-request is queued with the same id it was first sent with", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", f);
    const r = await postOrQueue("/api/expenses", { description: "Dinner" }, meta);
    expect(isQueued(r)).toBe(true);
    expect(JSON.parse(f.mock.calls[0][1].body).clientId).toBe(pendingItems()[0].id);
  });

  it("real server errors are NOT queued (the user must fix them)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "Not a member of this group" } }) }));
    await expect(postOrQueue("/api/expenses", {}, meta)).rejects.toThrow("Not a member");
    expect(pendingItems()).toEqual([]);
  });

  it("signed out: can't queue safely, so the offline error is shown instead", async () => {
    setOutboxUser(null);
    setOnline(false);
    await expect(postOrQueue("/api/expenses", {}, meta)).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("postOrQueue — a submission keeps ONE id until it is confirmed (no duplicate money)", () => {
  const sentIds = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => JSON.parse(c[1].body).clientId);

  it("after a server error, tapping Save again with the same details re-sends the SAME id", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ error: { message: "Internal server error" } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { id: "e1" } }) });
    vi.stubGlobal("fetch", f);
    await postOrQueue("/api/expenses", { description: "Dinner", amount: 100 }, meta).catch(() => {});
    await postOrQueue("/api/expenses", { description: "Dinner", amount: 100 }, meta);
    const [first, second] = sentIds(f);
    expect(first).toBe(second); // the server can dedupe if the first attempt actually got saved
  });

  it("a double-tap while the first request is in flight uses the same id", async () => {
    const f = vi.fn().mockResolvedValue({ json: async () => ({ data: { id: "e1" } }) });
    vi.stubGlobal("fetch", f);
    await Promise.all([
      postOrQueue("/api/expenses", { description: "Dinner", amount: 100 }, meta),
      postOrQueue("/api/expenses", { description: "Dinner", amount: 100 }, meta),
    ]);
    const [a, b] = sentIds(f);
    expect(a).toBe(b);
  });

  it("once confirmed, the same details entered again are a genuinely NEW expense (two identical coffees)", async () => {
    const f = vi.fn().mockResolvedValue({ json: async () => ({ data: { id: "e1" } }) });
    vi.stubGlobal("fetch", f);
    await postOrQueue("/api/expenses", { description: "Coffee", amount: 50 }, meta);
    await postOrQueue("/api/expenses", { description: "Coffee", amount: 50 }, meta);
    const [a, b] = sentIds(f);
    expect(a).not.toBe(b);
  });

  it("different details never share an id", async () => {
    const f = vi.fn().mockRejectedValue(new Error("x"));
    vi.stubGlobal("fetch", f);
    await postOrQueue("/api/expenses", { amount: 1 }, meta).catch(() => {});
    await postOrQueue("/api/expenses", { amount: 2 }, meta).catch(() => {});
    const [a, b] = sentIds(f);
    expect(a).not.toBe(b);
  });

  it("an answer that isn't an API reply (captive portal) is queued, not shown as a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => { throw new SyntaxError("<html>"); } }));
    expect(isQueued(await postOrQueue("/api/expenses", { amount: 1 }, meta))).toBe(true);
  });

  it("if the device refuses to store the write, the user is told it did NOT save", async () => {
    setOnline(false);
    const real = localStorage.setItem;
    localStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    await expect(postOrQueue("/api/expenses", { amount: 1 }, meta)).rejects.toBeInstanceOf(OfflineError);
    localStorage.setItem = real;
  });
});

describe("isQueued", () => {
  it("only matches queued markers", () => {
    expect(isQueued({ queued: true, id: "x" })).toBe(true);
    expect(isQueued({ id: "x" })).toBe(false);
    expect(isQueued(null)).toBe(false);
    expect(isQueued("queued")).toBe(false);
  });
});
