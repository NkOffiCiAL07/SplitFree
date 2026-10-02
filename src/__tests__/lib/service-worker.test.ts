// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/**
 * Runs public/sw.js for real inside a sandbox with a fake service-worker global (self, caches, fetch),
 * so the caching strategies are tested as shipped rather than re-implemented.
 */
type Handler = (event: unknown) => void;

function bootWorker() {
  const store = new Map<string, Map<string, Response>>(); // cacheName → url → response
  const listeners: Record<string, Handler> = {};
  const key = (r: Request | string) => (typeof r === "string" ? r : r.url);

  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        addAll: async (urls: string[]) => { for (const u of urls) c.set(new URL(u, "https://app.example").href, new Response("precached:" + u)); },
        put: async (r: Request | string, res: Response) => { c.set(key(r), res); },
        match: async (r: Request | string) => c.get(key(r))?.clone(),
        keys: async () => [...c.keys()].map((url) => ({ url })),
        delete: async (r: { url: string }) => c.delete(r.url),
      };
    },
    match: async (r: Request | string) => {
      const k = new URL(key(r), "https://app.example").href;
      for (const c of store.values()) { const hit = c.get(k); if (hit) return hit.clone(); }
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };

  const fetchMock = vi.fn();
  const sandbox = {
    self: { addEventListener: (type: string, fn: Handler) => { listeners[type] = fn; }, location: { origin: "https://app.example" }, skipWaiting: vi.fn(), clients: { claim: vi.fn() }, registration: { showNotification: vi.fn() } },
    caches, fetch: fetchMock, Response, Request, URL, Headers, Promise, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync("public/sw.js", "utf8"), sandbox);

  async function dispatchFetch(request: Request) {
    let responded: Promise<Response> | null = null;
    listeners.fetch({ request, respondWith: (p: Promise<Response>) => { responded = p; } });
    return responded ? await (responded as Promise<Response>) : null; // null = the worker let the browser handle it
  }
  return { store, listeners, fetchMock, dispatchFetch, sandbox };
}

const nav = (path: string, init: RequestInit = {}) => {
  const r = new Request(`https://app.example${path}`, init);
  Object.defineProperty(r, "mode", { value: "navigate" });
  return r;
};
const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://app.example${path}`, { headers });

let sw: ReturnType<typeof bootWorker>;
beforeEach(() => { sw = bootWorker(); });

describe("service worker — install and cleanup", () => {
  it("precaches only public, session-independent files (never an authenticated page)", async () => {
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.install({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    const cached = [...sw.store.get("splitfree-v7")!.keys()].map((u) => new URL(u).pathname);
    expect(cached).toContain("/offline");
    expect(cached).not.toContain("/dashboard"); // used to be cached as a redirect to /login
    expect(cached).not.toContain("/");
    expect(sw.sandbox.self.skipWaiting).toHaveBeenCalled();
  });

  it("deletes caches from older versions when it activates", async () => {
    sw.store.set("splitfree-v5", new Map([["https://app.example/x", new Response("old")]]));
    sw.store.set("splitfree-v7", new Map());
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect([...sw.store.keys()]).toEqual(["splitfree-v7"]);
  });
});

describe("service worker — what it leaves alone", () => {
  it.each([
    ["non-GET requests", () => new Request("https://app.example/api/expenses", { method: "POST", body: "{}" })],
    ["cross-origin requests", () => new Request("https://cdn.example/lib.js")],
    ["Next.js RSC fetches", () => nav("/groups", { headers: { RSC: "1" } })],
    ["Next.js router prefetches", () => nav("/groups", { headers: { "Next-Router-Prefetch": "1" } })],
    ["non-navigation requests", () => get("/some/data")],
  ])("ignores %s", async (_n, make) => {
    expect(await sw.dispatchFetch(make())).toBeNull();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });
});

describe("service worker — pages are network-first (correct sign-in state, newest deploy)", () => {
  it("serves the live page and caches a copy", async () => {
    sw.fetchMock.mockResolvedValue(new Response("live dashboard", { status: 200 }));
    const res = await sw.dispatchFetch(nav("/dashboard"));
    expect(await res!.text()).toBe("live dashboard");
    await new Promise((r) => setTimeout(r, 5));
    expect(sw.store.get("splitfree-v7")!.has("https://app.example/dashboard")).toBe(true);
  });

  it("prefers the network over an older cached copy (it used to show the stale copy first)", async () => {
    sw.store.set("splitfree-v7", new Map([["https://app.example/dashboard", new Response("stale")]]));
    sw.fetchMock.mockResolvedValue(new Response("fresh"));
    expect(await (await sw.dispatchFetch(nav("/dashboard")))!.text()).toBe("fresh");
  });

  it("offline: falls back to the last cached copy, then to the offline page", async () => {
    sw.fetchMock.mockRejectedValue(new Error("offline"));
    sw.store.set("splitfree-v7", new Map([["https://app.example/groups", new Response("cached groups")], ["https://app.example/offline", new Response("offline page")]]));
    expect(await (await sw.dispatchFetch(nav("/groups")))!.text()).toBe("cached groups");
    expect(await (await sw.dispatchFetch(nav("/never-visited")))!.text()).toBe("offline page");
  });

  it("offline with nothing cached at all returns a plain 503", async () => {
    sw.fetchMock.mockRejectedValue(new Error("offline"));
    const res = await sw.dispatchFetch(nav("/x"));
    expect(res!.status).toBe(503);
  });

  it("never caches error responses", async () => {
    sw.fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await sw.dispatchFetch(nav("/broken"));
    await new Promise((r) => setTimeout(r, 5));
    expect(sw.store.get("splitfree-v7")?.has("https://app.example/broken") ?? false).toBe(false);
  });

  it("never caches redirected responses (a login redirect can't stand in for a real page)", async () => {
    const redirected = new Response("login page");
    Object.defineProperty(redirected, "redirected", { value: true });
    sw.fetchMock.mockResolvedValue(redirected);
    await sw.dispatchFetch(nav("/dashboard"));
    await new Promise((r) => setTimeout(r, 5));
    expect(sw.store.get("splitfree-v7")?.has("https://app.example/dashboard") ?? false).toBe(false);
  });
});

describe("service worker — API requests are network-first with an offline fallback", () => {
  it("returns the live response and keeps a copy of successful ones only", async () => {
    sw.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: 1 }), { status: 200 }));
    const ok = await sw.dispatchFetch(get("/api/groups"));
    expect(await ok!.json()).toEqual({ data: 1 });
    sw.fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await sw.dispatchFetch(get("/api/balances"));
    await new Promise((r) => setTimeout(r, 5));
    const cache = sw.store.get("splitfree-v7")!;
    expect(cache.has("https://app.example/api/groups")).toBe(true);
    expect(cache.has("https://app.example/api/balances")).toBe(false); // errors aren't cached
  });

  it("offline: serves the cached copy, or a JSON 503 when there isn't one", async () => {
    sw.store.set("splitfree-v7", new Map([["https://app.example/api/groups", new Response(JSON.stringify({ data: "cached" }))]]));
    sw.fetchMock.mockRejectedValue(new Error("offline"));
    expect(await (await sw.dispatchFetch(get("/api/groups")))!.json()).toEqual({ data: "cached" });
    const none = await sw.dispatchFetch(get("/api/other"));
    expect(none!.status).toBe(503);
    expect((await none!.json()).error.message).toMatch(/offline/i);
  });
});

describe("service worker — static assets are cache-first (hashed files never change)", () => {
  it("serves from cache without touching the network, and caches on first use", async () => {
    sw.store.set("splitfree-v7", new Map([["https://app.example/_next/static/chunks/a.js", new Response("cached js")]]));
    expect(await (await sw.dispatchFetch(get("/_next/static/chunks/a.js")))!.text()).toBe("cached js");
    expect(sw.fetchMock).not.toHaveBeenCalled();

    sw.fetchMock.mockResolvedValue(new Response("new js"));
    expect(await (await sw.dispatchFetch(get("/_next/static/chunks/b.js")))!.text()).toBe("new js");
    await new Promise((r) => setTimeout(r, 5));
    expect(sw.store.get("splitfree-v7")!.has("https://app.example/_next/static/chunks/b.js")).toBe(true);
  });
});

describe("service worker — push notifications", () => {
  it("shows the notification with its tag and deep link", async () => {
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.push({ data: { json: () => ({ title: "Reminder", body: "Pay ₹500", url: "/settle", tag: "PAYMENT_REMINDER" }), text: () => "" }, waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    const [title, opts] = sw.sandbox.self.registration.showNotification.mock.calls[0];
    expect(title).toBe("Reminder");
    expect(opts).toMatchObject({ body: "Pay ₹500", tag: "PAYMENT_REMINDER", renotify: true, data: { url: "/settle" } });
  });

  it("survives a payload that isn't JSON, and ignores empty pushes", async () => {
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.push({ data: { json: () => { throw new Error("bad"); }, text: () => "plain text" }, waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(sw.sandbox.self.registration.showNotification.mock.calls[0][1]).toMatchObject({ body: "plain text" });
    sw.sandbox.self.registration.showNotification.mockClear();
    sw.listeners.push({ data: null, waitUntil: () => {} });
    expect(sw.sandbox.self.registration.showNotification).not.toHaveBeenCalled();
  });
});
