import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

import { getAuthUser, requireAuth } from "@/lib/api-helpers";

beforeEach(() => { vi.clearAllMocks(); });

describe("API authentication uses local token verification", () => {
  it("returns id and email from the verified claims, without calling the auth server", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "me@x.com", role: "authenticated" } }, error: null });
    expect(await getAuthUser()).toEqual({ id: "u1", email: "me@x.com" });
    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getUser).not.toHaveBeenCalled(); // that network round trip used to happen on every API call
  });

  it("is signed out when the token is missing, invalid or expired", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error("no session") });
    expect(await getAuthUser()).toBeNull();
    auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null }); // no subject
    expect(await getAuthUser()).toBeNull();
    auth.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getAuthUser()).toBeNull();
  });

  it("requireAuth turns that into a 401 JSON response, or the user", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error("expired") });
    const denied = await requireAuth();
    expect(denied.user).toBeNull();
    expect(denied.error?.status).toBe(401);
    expect(await denied.error?.json()).toEqual({ error: { message: "Unauthorized" } });

    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u2", email: "a@x.com" } }, error: null });
    const allowed = await requireAuth();
    expect(allowed.error).toBeNull();
    expect(allowed.user).toEqual({ id: "u2", email: "a@x.com" });
  });

  it("works for accounts without an email claim (the type allows it)", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u3" } }, error: null });
    expect(await getAuthUser()).toEqual({ id: "u3", email: undefined });
  });
});
