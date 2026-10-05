import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { prismaMock, resetPrisma, authState, ME } from "./helpers";

// The sign-in token carries what the person typed at sign-up (name + mobile number) in user_metadata
const meta = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return {
    createClient: async () => ({
      auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email, user_metadata: meta.value } } : null, error: null }) },
    }),
  };
});

import { GET, PATCH } from "@/app/api/profile/route";
import { getAuthUser, resetKnownUsers } from "@/lib/api-helpers";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const patch = (body: unknown) => PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  resetPrisma();
  resetKnownUsers();
  meta.value = {};
  authState.user = { id: ME, email: "me@example.com" };
  p.user.findUnique.mockResolvedValue({ id: ME, name: "Me" });
  p.user.update.mockResolvedValue({ id: ME });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PATCH /api/profile — mobile number", () => {
  it("saves it in international format however it was typed", async () => {
    for (const [typed, stored] of [["98765 43210", "+919876543210"], ["+91-98765-43210", "+919876543210"], ["+44 7911 123456", "+447911123456"]]) {
      p.user.update.mockClear();
      const res = await patch({ phone: typed });
      expect(res.status).toBe(200);
      const args = p.user.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: ME });
      expect(args.data.phone).toBe(stored);
    }
  });

  it("hands the owner back their own number (it is hidden from every other query by default)", async () => {
    await patch({ phone: "98765 43210" });
    expect(p.user.update.mock.calls[0][0].omit).toEqual({ phone: false });
  });

  it("rejects a missing, empty or impossible number — and never lets it be cleared", async () => {
    for (const bad of ["", "   ", "12345", "abc", null]) expect((await patch({ phone: bad })).status, String(bad)).toBe(422);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("a PATCH without a phone leaves the saved number alone", async () => {
    await patch({ name: "New name" });
    expect(p.user.update.mock.calls[0][0].data).toEqual({ name: "New name" });
  });
});

describe("GET /api/profile", () => {
  it("asks for the owner's own number explicitly", async () => {
    await GET();
    expect(p.user.findUnique.mock.calls.at(-1)[0].omit).toEqual({ phone: false });
  });

  it("creates the row for a brand-new account first, with the name and number from sign-up", async () => {
    meta.value = { name: "Asha Rao", phone_number: "+919876543210" };
    p.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: ME, phone: "+919876543210" }); // ensure → none, then the read
    p.user.upsert.mockResolvedValue({ id: ME });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(p.user.upsert.mock.calls[0][0].create).toMatchObject({ id: ME, name: "Asha Rao", phone: "+919876543210" });
  });
});

describe("the sign-in token's sign-up details", () => {
  it("getAuthUser reads the name and a valid number; ignores junk", async () => {
    meta.value = { name: "  Asha Rao ", phone_number: "98765 43210" };
    expect(await getAuthUser()).toMatchObject({ id: ME, name: "Asha Rao", phone: "+919876543210" });
    meta.value = { name: 42, phone_number: "nonsense" };
    expect(await getAuthUser()).toMatchObject({ id: ME, name: undefined, phone: undefined });
    meta.value = {};
    expect((await getAuthUser())?.phone).toBeUndefined();
  });
});

// Other people's numbers must never leave the server: every query hides `phone` unless the code opts in
describe("mobile numbers stay private", () => {
  it("the database client leaves phone out of every query by default", () => {
    expect(readFileSync("src/lib/prisma.ts", "utf8")).toContain("omit: { user: { phone: true } }");
  });

  it("only the owner's own profile and data export ever read it", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(f)) files.push(full);
      }
    };
    walk("src/app");
    walk("src/lib");
    const readers = files.filter((f) => /\bphone:\s*(false|true)/.test(readFileSync(f, "utf8")) && !f.includes("lib/prisma.ts"));
    expect(readers.sort()).toEqual(["src/app/api/account/export/route.ts", "src/app/api/profile/route.ts"]);
  });
});
