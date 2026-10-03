import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setOutboxUser, enqueue, pendingItems, removeItem, retryItem, clearOutbox, flushOutbox, subscribeOutbox, newClientId, MAX_QUEUED,
} from "@/lib/offline/outbox";

const item = (id: string, over = {}) => ({ id, kind: "expense" as const, url: "/api/expenses", body: { description: id }, label: id, amount: 10, currency: "INR", ...over });
const reply = (status: number, json: unknown = { data: {} }) => ({ ok: status < 400, status, json: async () => json });

beforeEach(() => { setOutboxUser("u1"); });
afterEach(() => vi.unstubAllGlobals());

describe("outbox — queueing", () => {
  it("queues for the current user, in order, and survives a reload (persisted)", () => {
    enqueue(item("a")); enqueue(item("b"));
    expect(pendingItems().map((i) => i.id)).toEqual(["a", "b"]);
    setOutboxUser(null); setOutboxUser("u1"); // simulates reading it back
    expect(pendingItems().map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("can't queue when nobody is signed in", () => {
    setOutboxUser(null);
    expect(enqueue(item("a"))).toBeNull();
  });

  it("only shows (and sends) the signed-in user's items — never another account's", () => {
    enqueue(item("mine"));
    setOutboxUser("u2");
    expect(pendingItems()).toEqual([]);
    enqueue(item("theirs"));
    setOutboxUser("u1");
    expect(pendingItems().map((i) => i.id)).toEqual(["mine"]);
  });

  it("clearOutbox wipes everything (sign-out)", () => {
    enqueue(item("a"));
    clearOutbox();
    expect(pendingItems()).toEqual([]);
    expect(localStorage.getItem("splitfree-outbox-v1")).toBeNull();
  });

  it("notifies subscribers on changes and stops after unsubscribe", () => {
    const cb = vi.fn();
    const off = subscribeOutbox(cb);
    enqueue(item("a"));
    removeItem("a");
    expect(cb).toHaveBeenCalledTimes(2);
    off(); enqueue(item("b"));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("tolerates corrupted storage", () => {
    localStorage.setItem("splitfree-outbox-v1", "{not json");
    setOutboxUser("u1");
    expect(pendingItems()).toEqual([]);
  });

  it("queuing the same id twice keeps a single entry (double-tap safe)", () => {
    enqueue(item("a")); enqueue(item("a"));
    expect(pendingItems()).toHaveLength(1);
  });

  it("refuses (returns null) rather than pretend when the device won't store it", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const real = localStorage.setItem;
    localStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    expect(enqueue(item("a"))).toBeNull();
    localStorage.setItem = real;
    spy.mockRestore();
    expect(pendingItems()).toEqual([]);
  });

  it(`has a cap of ${200} queued items per user`, () => {
    for (let i = 0; i < MAX_QUEUED; i++) expect(enqueue(item(`i${i}`))).not.toBeNull();
    expect(enqueue(item("one-too-many"))).toBeNull();
  });

  it("another tab's change shows up here (storage event)", () => {
    enqueue(item("a"));
    const cb = vi.fn();
    subscribeOutbox(cb);
    localStorage.setItem("splitfree-outbox-v1", JSON.stringify([{ ...item("z"), userId: "u1", createdAt: 1, status: "pending" }]));
    window.dispatchEvent(new StorageEvent("storage", { key: "splitfree-outbox-v1" }));
    expect(pendingItems().map((i) => i.id)).toEqual(["z"]);
    expect(cb).toHaveBeenCalled();
  });

  it("generates unique client ids", () => {
    expect(newClientId()).not.toBe(newClientId());
    expect(newClientId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("outbox — flushing", () => {
  it("sends each item with its id as clientId, in order, and removes it once saved", async () => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockResolvedValue(reply(201));
    vi.stubGlobal("fetch", f);
    const r = await flushOutbox();
    expect(r.synced.map((i) => i.id)).toEqual(["a", "b"]);
    expect(f.mock.calls.map((c) => JSON.parse(c[1].body).clientId)).toEqual(["a", "b"]);
    expect(JSON.parse(f.mock.calls[0][1].body).description).toBe("a");
    expect(pendingItems()).toEqual([]);
  });

  it("stops at a network failure and keeps the rest queued, in order", async () => {
    enqueue(item("a")); enqueue(item("b")); enqueue(item("c"));
    const f = vi.fn().mockResolvedValueOnce(reply(201)).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", f);
    const r = await flushOutbox();
    expect(r.offline).toBe(true);
    expect(r.synced.map((i) => i.id)).toEqual(["a"]);
    expect(pendingItems().map((i) => i.id)).toEqual(["b", "c"]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it.each([500, 502, 429, 408])("keeps the item for a retry on a %i", async (status) => {
    enqueue(item("a"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status)));
    const r = await flushOutbox();
    expect(r.offline).toBe(true);
    expect(pendingItems()).toHaveLength(1);
  });

  it.each([400, 403, 404, 409, 422])("a write the server refuses for good (%i) is KEPT, marked failed, and reported — never deleted", async (status) => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockResolvedValueOnce(reply(status, { error: { message: "This group is archived" } })).mockResolvedValueOnce(reply(201));
    vi.stubGlobal("fetch", f);
    const r = await flushOutbox();
    expect(r.failed).toEqual([{ item: expect.objectContaining({ id: "a" }), message: "This group is archived" }]);
    expect(r.synced.map((i) => i.id)).toEqual(["b"]); // one bad item doesn't block the rest
    expect(pendingItems()).toEqual([expect.objectContaining({ id: "a", status: "failed", error: "This group is archived" })]);
  });

  it("failed items are not re-sent automatically on later flushes", async () => {
    enqueue(item("a"));
    const f = vi.fn().mockResolvedValue(reply(403, { error: { message: "no" } }));
    vi.stubGlobal("fetch", f);
    await flushOutbox();
    await flushOutbox();
    await flushOutbox();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("the user can retry a failed item (back in the queue) or discard it", async () => {
    enqueue(item("a")); enqueue(item("b"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, { error: { message: "no" } })));
    await flushOutbox();
    expect(pendingItems().every((i) => i.status === "failed")).toBe(true);

    retryItem("a");
    expect(pendingItems().find((i) => i.id === "a")).toMatchObject({ status: "pending", error: undefined });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(201)));
    await flushOutbox();
    expect(pendingItems().map((i) => i.id)).toEqual(["b"]);

    removeItem("b");
    expect(pendingItems()).toEqual([]);
  });

  it("an expired session (401) keeps everything and stops — it is not a final answer", async () => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockResolvedValue(reply(401, { error: { message: "Unauthorized" } }));
    vi.stubGlobal("fetch", f);
    const r = await flushOutbox();
    expect(r.offline).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(pendingItems().map((i) => i.status)).toEqual(["pending", "pending"]);
  });

  it("a 200 that isn't an API reply (captive-portal / proxy page) is NOT treated as saved", async () => {
    enqueue(item("a"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("<html>"); } }));
    const r = await flushOutbox();
    expect(r.synced).toEqual([]);
    expect(r.offline).toBe(true);
    expect(pendingItems()).toHaveLength(1);
  });

  it("a 2xx JSON body without data is not treated as saved either", async () => {
    enqueue(item("a"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ hello: "world" }) }));
    expect((await flushOutbox()).synced).toEqual([]);
    expect(pendingItems()).toHaveLength(1);
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    enqueue(item("a"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => { throw new Error("x"); } }));
    expect((await flushOutbox()).failed[0].message).toMatch(/403/);
  });

  it("skips an item another tab already sent while this tab was working", async () => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockImplementation(async () => {
      localStorage.setItem("splitfree-outbox-v1", JSON.stringify([])); // the other tab finished everything
      return reply(201);
    });
    vi.stubGlobal("fetch", f);
    await flushOutbox();
    expect(f).toHaveBeenCalledTimes(1); // "b" was not sent a second time
  });

  it("stops at once if the account changes mid-flush, and never sends the old user's writes as the new user", async () => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockImplementation(async () => { setOutboxUser("u2"); return reply(201); });
    vi.stubGlobal("fetch", f);
    await flushOutbox();
    expect(f).toHaveBeenCalledTimes(1);
    setOutboxUser("u1");
    expect(pendingItems().map((i) => i.id)).toContain("b");
  });

  it("overlapping flushes share one run (no double sends)", async () => {
    enqueue(item("a"));
    const f = vi.fn().mockResolvedValue(reply(201));
    vi.stubGlobal("fetch", f);
    await Promise.all([flushOutbox(), flushOutbox(), flushOutbox()]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("an empty queue sends nothing", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await flushOutbox()).toEqual({ synced: [], failed: [], offline: false });
    expect(f).not.toHaveBeenCalled();
  });
});
