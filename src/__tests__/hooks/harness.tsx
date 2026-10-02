import { vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** A fresh QueryClient (no retries, no cache sharing) wrapped for renderHook. */
export function createHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  /** Query keys passed to invalidateQueries so far. */
  const invalidated = () => invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
  return { qc, wrapper, invalidated };
}

type Reply = { data?: unknown; error?: { message: string } };

/**
 * Stubs global fetch. Pass a single reply, or a function of (url, init) for per-endpoint replies.
 * Every call is recorded in the returned mock so tests can assert URL, method and body.
 */
export function stubFetch(reply: Reply | ((url: string, init?: RequestInit) => Reply) = { data: {} }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (typeof reply === "function" ? reply(url, init) : reply),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Method + parsed JSON body of the Nth fetch call. */
export function callOf(fn: ReturnType<typeof stubFetch>, n = 0) {
  const [url, init] = fn.mock.calls[n] as [string, RequestInit | undefined];
  return { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined };
}
