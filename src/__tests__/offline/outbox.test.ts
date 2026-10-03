import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setOutboxUser, enqueue, pendingItems, removeItem, clearOutbox, flushOutbox, subscribeOutbox, newClientId,
} from "@/lib/offline/outbox";

const store = vi.hoisted(() => new Map<string, string>());
vi.hoisted(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
  });
});

const item = (id: string, over = {}) => ({ id, kind: "expense" as const, url: "/api/expenses", body: { description: id }, label: id, amount: 10, currency: "INR", ...over });
const reply = (status: number, json: unknown = {}) => ({ ok: status < 400, status, json: async () => json });

beforeEach(() => { store.clear(); setOutboxUser("u1"); });
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
    expect(store.size).toBe(0);
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
    store.set("splitfree-outbox-v1", "{not json");
    setOutboxUser("u1");
    expect(pendingItems()).toEqual([]);
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

  it.each([400, 403, 404, 409, 422])("drops and reports an item the server permanently rejects (%i)", async (status) => {
    enqueue(item("a")); enqueue(item("b"));
    const f = vi.fn().mockResolvedValueOnce(reply(status, { error: { message: "This group is archived" } })).mockResolvedValueOnce(reply(201));
    vi.stubGlobal("fetch", f);
    const r = await flushOutbox();
    expect(r.failed).toEqual([{ item: expect.objectContaining({ id: "a" }), message: "This group is archived" }]);
    expect(r.synced.map((i) => i.id)).toEqual(["b"]); // one bad item doesn't block the rest
    expect(pendingItems()).toEqual([]);
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    enqueue(item("a"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => { throw new Error("x"); } }));
    expect((await flushOutbox()).failed[0].message).toMatch(/403/);
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
