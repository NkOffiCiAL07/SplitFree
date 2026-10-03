import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setOutboxUser, pendingItems, flushOutbox, clearOutbox } from "@/lib/offline/outbox";
import { postOrQueue, isQueued, resetAttempts } from "@/lib/offline/queued-write";

/**
 * A fake server that behaves like the real routes (a repeated clientId returns the saved row instead of creating
 * another) behind a network that misbehaves randomly. Whatever the failures, replaying must end with every write
 * saved EXACTLY once and the totals matching what the user entered.
 */
function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

type Mode = "drop-before" | "drop-after-save" | "server-500-before-save" | "html-502" | "html-200" | "expired-session" | "ok";

function makeWorld(seed: number, weights: Record<Mode, number>) {
  const r = rng(seed);
  const saved = new Map<string, { amount: number; label: string }>();
  let calls = 0;
  const modes = Object.entries(weights) as [Mode, number][];
  const total = modes.reduce((s, [, w]) => s + w, 0);
  const pick = (): Mode => { let x = r() * total; for (const [m, w] of modes) if ((x -= w) < 0) return m; return "ok"; };

  const save = (body: { clientId: string; amount: number; description?: string }) => {
    if (!saved.has(body.clientId)) saved.set(body.clientId, { amount: body.amount, label: body.description ?? "" }); // idempotent
    return { data: { id: body.clientId } };
  };

  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    calls++;
    const body = JSON.parse(init.body as string);
    switch (pick()) {
      case "drop-before": throw new TypeError("Failed to fetch");
      case "drop-after-save": save(body); throw new TypeError("Failed to fetch"); // saved, but the reply never arrived
      case "server-500-before-save": return { ok: false, status: 500, json: async () => ({ error: { message: "Internal server error" } }) };
      case "html-502": return { ok: false, status: 502, json: async () => { throw new SyntaxError("<html>"); } };
      case "html-200": return { ok: true, status: 200, json: async () => { throw new SyntaxError("<html>"); } }; // captive portal
      case "expired-session": return { ok: false, status: 401, json: async () => ({ error: { message: "Unauthorized" } }) };
      default: return { ok: true, status: 201, json: async () => save(body) };
    }
  });
  return { saved, fetchMock, calls: () => calls };
}

const NASTY: Record<Mode, number> = { "drop-before": 3, "drop-after-save": 3, "server-500-before-save": 2, "html-502": 1, "html-200": 1, "expired-session": 1, ok: 4 };

beforeEach(() => { clearOutbox(); setOutboxUser("u1"); resetAttempts(); vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function drain(max = 500) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  for (let i = 0; i < max && pendingItems().some((x) => x.status !== "failed"); i++) await flushOutbox();
}

describe.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("chaos replay (seed %i)", (seed) => {
  it("every queued write is saved exactly once and the totals match, despite drops, lost replies, 5xx and captive portals", async () => {
    const world = makeWorld(seed, NASTY);
    vi.stubGlobal("fetch", world.fetchMock);

    // 40 writes entered while offline
    const entered: { amount: number; label: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const amount = 10 + i * 7.35;
      entered.push({ amount, label: `Item ${i}` });
      const r = await postOrQueue("/api/expenses", { description: `Item ${i}`, amount }, { kind: "expense", label: `Item ${i}`, amount, currency: "INR" });
      expect(isQueued(r)).toBe(true);
    }
    expect(pendingItems()).toHaveLength(40);

    await drain();

    expect(pendingItems()).toEqual([]);                       // nothing stuck, nothing failed
    expect(world.saved.size).toBe(40);                         // one record per write: no loss, no duplicates
    const savedTotal = [...world.saved.values()].reduce((s, x) => s + Math.round(x.amount * 100), 0);
    const enteredTotal = entered.reduce((s, x) => s + Math.round(x.amount * 100), 0);
    expect(savedTotal).toBe(enteredTotal);                     // the money adds up to the paisa
    expect(world.calls()).toBeGreaterThan(40);                 // and the chaos really did force retries
  });
});

describe("chaos — online writes that fail mid-flight and are retried by the user", () => {
  it("tapping Save again after an ambiguous failure never creates a second record", async () => {
    const world = makeWorld(99, { ...NASTY, "drop-before": 0, "expired-session": 0 });
    vi.stubGlobal("fetch", world.fetchMock);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const payload = { description: "Taxi", amount: 349.5 };
    const meta = { kind: "expense" as const, label: "Taxi", amount: 349.5, currency: "INR" };

    // The user keeps pressing Save until they see success (or the app says it saved it for later)
    for (let attempt = 0; attempt < 50; attempt++) {
      const r = await postOrQueue("/api/expenses", payload, meta).catch(() => null);
      if (r) break;
    }
    await drain();
    expect(world.saved.size).toBe(1);
    expect([...world.saved.values()][0].amount).toBe(349.5);
  });
});

describe("chaos — permanent rejections never lose or duplicate money", () => {
  it("a refused write is kept (not deleted, not re-sent) while the others still sync", async () => {
    const saved = new Set<string>();
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      if (b.description === "bad") return { ok: false, status: 409, json: async () => ({ error: { message: "This group is archived" } }) };
      saved.add(b.clientId);
      return { ok: true, status: 201, json: async () => ({ data: { id: b.clientId } }) };
    }));
    for (const d of ["a", "bad", "b"]) await postOrQueue("/api/expenses", { description: d, amount: 1 }, { kind: "expense", label: d, amount: 1, currency: "INR" });
    await drain();
    expect(saved.size).toBe(2);
    expect(pendingItems()).toHaveLength(1);
    expect(pendingItems()[0]).toMatchObject({ label: "bad", status: "failed", error: "This group is archived" });
  });
});
