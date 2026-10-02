// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `getUser` stands in for "is someone signed in?" (tests set it up like before); the middleware must read it
// through getClaims (local token verification) and must NEVER call the network-based auth.getUser.
const { getUser, serverGetUser } = vi.hoisted(() => ({ getUser: vi.fn(), serverGetUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => {
        const r = await getUser();
        return { data: r?.data?.user ? { claims: { sub: r.data.user.id } } : null, error: null };
      },
      getUser: serverGetUser,
    },
  }),
}));

// Requests must come from the same `next/server` instance the module under test loads after
// vi.resetModules(), so the class is (re)imported alongside it.
let NextRequestCtor: typeof import("next/server").NextRequest;
const req = (path: string) => new NextRequestCtor(`https://app.example${path}`);
const location = (res: Response) => res.headers.get("location");

describe("updateSession (page protection)", () => {
  let updateSession: typeof import("@/lib/supabase/middleware").updateSession;
  beforeEach(async () => {
    vi.resetModules();
    getUser.mockReset();
    ({ NextRequest: NextRequestCtor } = await import("next/server"));
    ({ updateSession } = await import("@/lib/supabase/middleware"));
  });

  it("verifies the session locally and never calls the auth server on a page navigation", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await updateSession(req("/dashboard"));
    expect(serverGetUser).not.toHaveBeenCalled();
  });

  describe("signed out", () => {
    beforeEach(() => getUser.mockResolvedValue({ data: { user: null } }));

    it.each(["/dashboard", "/groups", "/groups/abc", "/expenses", "/friends/xyz", "/settings", "/import", "/settle"])(
      "sends %s to login and remembers where they were going",
      async (path) => {
        const res = await updateSession(req(path));
        expect(res.status).toBe(307);
        const url = new URL(location(res)!);
        expect(url.pathname).toBe("/login");
        expect(url.searchParams.get("redirect")).toBe(path);
      }
    );

    it.each(["/", "/login", "/signup", "/reset-password", "/auth/callback", "/join/abc", "/offline", "/privacy", "/support", "/api/anything"])(
      "lets %s through",
      async (path) => {
        const res = await updateSession(req(path));
        expect(res.status).toBe(200);
        expect(location(res)).toBeNull();
      }
    );
  });

  describe("signed in", () => {
    beforeEach(() => getUser.mockResolvedValue({ data: { user: { id: "u1" } } }));

    it.each(["/login", "/signup", "/reset-password"])("bounces %s to the dashboard", async (path) => {
      const res = await updateSession(req(`${path}?redirect=/groups`));
      expect(res.status).toBe(307);
      const url = new URL(location(res)!);
      expect(url.pathname).toBe("/dashboard");
      expect(url.searchParams.has("redirect")).toBe(false);
    });

    it("lets them use the app and public pages", async () => {
      for (const path of ["/dashboard", "/groups/abc", "/", "/join/abc"]) {
        expect((await updateSession(req(path))).status).toBe(200);
      }
    });
  });
});

describe("proxy", () => {
  const load = async (url: string | undefined) => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (url !== undefined) vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
    ({ NextRequest: NextRequestCtor } = await import("next/server"));
    return import("@/proxy");
  };
  afterEach(() => vi.unstubAllEnvs());

  it("lets API requests through without a second auth round-trip (routes authenticate themselves)", async () => {
    const { proxy } = await load("https://real.supabase.co");
    const res = await proxy(req("/api/expenses"));
    expect(res.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("protects pages when Supabase is configured", async () => {
    const { proxy } = await load("https://real.supabase.co");
    const res = await proxy(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("is a no-op when Supabase isn't configured (local UI work) or uses the placeholder URL", async () => {
    for (const url of [undefined, "", "http://localhost:54321", "https://placeholder.supabase.co"]) {
      const { proxy } = await load(url);
      expect((await proxy(req("/dashboard"))).status).toBe(200);
    }
  });

  it("the matcher skips static assets and the service worker", async () => {
    const { config } = await load("https://real.supabase.co");
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const skipped of ["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/manifest.json", "/sw.js", "/offline", "/logo.png", "/icons/a.svg"]) {
      expect(re.test(skipped)).toBe(false);
    }
    for (const matched of ["/", "/dashboard", "/api/expenses", "/groups/abc"]) {
      expect(re.test(matched)).toBe(true);
    }
  });
});
