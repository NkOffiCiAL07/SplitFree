import { vi } from "vitest";

/**
 * Lightweight Prisma mock: every `prisma.<model>.<method>` is a vi.fn created on first access,
 * so a test only stubs what the route under test calls. `$transaction(fn)` runs fn with the mock.
 */
type Fn = ReturnType<typeof vi.fn>;
const models = new Map<string, Map<string, Fn>>();

function model(name: string) {
  let methods = models.get(name);
  if (!methods) {
    methods = new Map();
    models.set(name, methods);
  }
  const m = methods;
  return new Proxy({}, {
    get(_t, method: string) {
      let fn = m.get(method);
      if (!fn) {
        fn = vi.fn();
        m.set(method, fn);
      }
      return fn;
    },
  });
}

export const prismaMock: Record<string, unknown> = new Proxy({}, {
  get(_t, key: string) {
    if (key === "$transaction") {
      return async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.all(arg as unknown[]));
    }
    return model(key);
  },
});

/** Clears every stub/call so tests don't leak into each other. */
export function resetPrisma() {
  models.forEach((methods) => methods.forEach((fn) => fn.mockReset()));
}

/** Signed-in user returned by the mocked Supabase client (set to null for "signed out"). */
export const authState: { user: { id: string; email: string } | null } = {
  user: { id: "11111111-1111-4111-8111-111111111111", email: "me@example.com" },
};

export const ME = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const STRANGER = "33333333-3333-4333-8333-333333333333";
export const GROUP = "44444444-4444-4444-8444-444444444444";
