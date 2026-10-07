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

  it("the iPhone app is sent from the marketing page straight to the dashboard (and from there to sign-in when signed out)", async () => {
    const appReq = (path: string) => new NextRequestCtor(`https://app.example${path}`, { headers: { "user-agent": "Mozilla/5.0 (iPhone) Mobile/15E148 SplitrProApp/1.0" } });
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(appReq("/"));
    expect(res.status).toBe(307);
    expect(new URL(location(res)!).pathname).toBe("/dashboard");
    // …only for "/", only for the app: other pages and normal browsers are untouched
    expect((await updateSession(appReq("/privacy"))).status).toBe(200);
    expect((await updateSession(req("/"))).status).toBe(200);
  });

  describe("English home page for visitors outside India", () => {
    const fromCountry = (path: string, country?: string, ua?: string) => new NextRequestCtor(`https://app.example${path}`, { headers: { ...(country ? { "x-vercel-ip-country": country } : {}), ...(ua ? { "user-agent": ua } : {}) } });
    const rewritten = (res: Response) => res.headers.get("x-middleware-rewrite");

    it("rewrites '/' to the international page for any country but India — at the SAME address (no redirect)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      for (const c of ["US", "GB", "DE", "ae"]) {
        const res = await updateSession(fromCountry("/", c));
        expect(res.status, c).toBe(200);
        expect(rewritten(res), c).toMatch(/\/intl$/);
        expect(res.headers.get("location"), c).toBeNull();
      }
    });

    it("leaves India, a request with no country, other pages, and the iPhone app alone", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      expect(rewritten(await updateSession(fromCountry("/", "IN")))).toBeNull();
      expect(rewritten(await updateSession(fromCountry("/")))).toBeNull();
      expect(rewritten(await updateSession(fromCountry("/privacy", "US")))).toBeNull();
      const app = await updateSession(fromCountry("/", "US", "Mozilla/5.0 (iPhone) SplitrProApp/1.0"));
      expect(rewritten(app)).toBeNull(); // the app goes to the dashboard instead
      expect(app.status).toBe(307);
    });

    it("the international page is public (no sign-in needed)", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const res = await updateSession(fromCountry("/intl", "US"));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
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

    it.each(["/", "/login", "/signup", "/reset-password", "/auth/callback", "/join/abc", "/offline", "/privacy", "/support", "/delete-account", "/downloads/SplitFree.apk", "/api/anything"])(
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
    for (const skipped of ["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/manifest.json", "/sw.js", "/offline", "/logo.png", "/icons/a.svg", "/downloads/SplitFree.apk", "/other/app.apk"]) {
      expect(re.test(skipped)).toBe(false);
    }
    for (const matched of ["/", "/dashboard", "/api/expenses", "/groups/abc"]) {
      expect(re.test(matched)).toBe(true);
    }
  });
});
