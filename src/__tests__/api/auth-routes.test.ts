import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock, resetPrisma } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
const supabase = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: supabase.exchangeCodeForSession, getUser: supabase.getUser } }),
  createAdminClient: async () => ({ auth: { admin: { createUser: supabase.createUser } } }),
}));

import { GET as CALLBACK } from "@/app/auth/callback/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ORIGIN = "https://app.example";
const callback = (qs: string) => CALLBACK(new Request(`${ORIGIN}/auth/callback${qs}`));
const location = (res: Response) => res.headers.get("location");
const authUser = { id: "u1", email: "me@example.com", user_metadata: { name: "Google Name", avatar_url: "https://g/a.png" } };

beforeEach(() => {
  resetPrisma();
  vi.clearAllMocks();
  supabase.exchangeCodeForSession.mockResolvedValue({ error: null });
  supabase.getUser.mockResolvedValue({ data: { user: authUser } });
  p.user.upsert.mockResolvedValue({});
  p.groupInvite.findMany.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("GET /auth/callback", () => {
  it("sends users without a code back to login with an error", async () => {
    expect(location(await callback(""))).toBe(`${ORIGIN}/login?error=auth_failed`);
    expect(supabase.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sends users back to login when the code exchange fails or throws", async () => {
    supabase.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    expect(location(await callback("?code=x"))).toBe(`${ORIGIN}/login?error=auth_failed`);
    supabase.exchangeCodeForSession.mockRejectedValue(new Error("network"));
    expect(location(await callback("?code=x"))).toBe(`${ORIGIN}/login?error=auth_failed`);
  });

  it("redirects to the dashboard by default and to a safe `next` path when given", async () => {
    expect(location(await callback("?code=x"))).toBe(`${ORIGIN}/dashboard`);
    expect(location(await callback("?code=x&next=/groups/g1"))).toBe(`${ORIGIN}/groups/g1`);
  });

  it("never redirects off-site, whatever `next` says (open-redirect fix)", async () => {
    for (const next of ["@evil.com", "//evil.com", "https://evil.com", "/\\evil.com"]) {
      const target = location(await callback(`?code=x&next=${encodeURIComponent(next)}`))!;
      expect(new URL(target).origin).toBe(ORIGIN);
      expect(target).toBe(`${ORIGIN}/dashboard`);
    }
  });

  it("creates the profile on first login, but never overwrites a name/avatar the user edited", async () => {
    await callback("?code=x");
    const args = p.user.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({ id: "u1", email: "me@example.com", name: "Google Name", avatarUrl: "https://g/a.png" });
    expect(args.update).toEqual({ email: "me@example.com" }); // name/avatar untouched on later logins
  });

  it("derives a name from the email when the provider gives none", async () => {
    supabase.getUser.mockResolvedValue({ data: { user: { id: "u2", email: "priya.k@x.com", user_metadata: {} } } });
    await callback("?code=x");
    expect(p.user.upsert.mock.calls[0][0].create).toMatchObject({ name: "priya.k", avatarUrl: null });
  });

  it("accepts pending group invites for this email, then deletes them", async () => {
    p.groupInvite.findMany.mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }]);
    p.groupMember.upsert.mockResolvedValue({});
    p.groupInvite.deleteMany.mockResolvedValue({});
    await callback("?code=x");
    expect(p.groupMember.upsert).toHaveBeenCalledTimes(2);
    expect(p.groupMember.upsert.mock.calls[0][0].create).toEqual({ groupId: "g1", userId: "u1", role: "MEMBER" });
    expect(p.groupInvite.deleteMany).toHaveBeenCalledWith({ where: { email: "me@example.com" } });
  });

  it("a database failure doesn't block a successful sign-in", async () => {
    p.user.upsert.mockRejectedValue(new Error("db down"));
    expect(location(await callback("?code=x"))).toBe(`${ORIGIN}/dashboard`);
  });

  it("one failing invite doesn't stop the others", async () => {
    p.groupInvite.findMany.mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }]);
    p.groupMember.upsert.mockRejectedValueOnce(new Error("dup")).mockResolvedValueOnce({});
    await callback("?code=x");
    expect(p.groupMember.upsert).toHaveBeenCalledTimes(2);
  });
});
