import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postOrQueue, isQueued } from "@/lib/offline/queued-write";
import { setOutboxUser, pendingItems, clearOutbox } from "@/lib/offline/outbox";
import { OfflineError } from "@/lib/api-client";

const meta = { kind: "expense" as const, label: "Dinner", amount: 250, currency: "INR" };
const setOnline = (v: boolean) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);

beforeEach(() => { clearOutbox(); setOutboxUser("u1"); setOnline(true); });
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

describe("isQueued", () => {
  it("only matches queued markers", () => {
    expect(isQueued({ queued: true, id: "x" })).toBe(true);
    expect(isQueued({ id: "x" })).toBe(false);
    expect(isQueued(null)).toBe(false);
    expect(isQueued("queued")).toBe(false);
  });
});
