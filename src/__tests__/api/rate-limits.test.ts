import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { POST as CREATE_EXPENSE } from "@/app/api/expenses/route";
import { POST as CREATE_SETTLEMENT } from "@/app/api/settlements/route";
import { GET as JOIN_PREVIEW } from "@/app/api/join/[token]/route";
import { GET as EXPORT } from "@/app/api/export/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const post = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { method: "POST", body: "{}", headers });
const statuses = async (n: number, fire: () => Promise<Response>) => { const out: number[] = []; for (let i = 0; i < n; i++) out.push((await fire()).status); return out; };

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("limits protect the service without hurting normal use", () => {
  it("expenses: 120 writes a minute per PERSON is plenty (an offline queue replaying 50 entries is fine), the 121st is refused with Retry-After", async () => {
    const all = await statuses(121, () => CREATE_EXPENSE(post("http://x/api/expenses")));
    expect(all.slice(0, 120).every((s) => s !== 429)).toBe(true);
    expect(all[120]).toBe(429);
    const res = await CREATE_EXPENSE(post("http://x/api/expenses"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });

  it("…and one person hitting the limit never blocks someone else on the same shared address (office, college, mobile carrier)", async () => {
    const shared = { "x-forwarded-for": "203.0.113.50" };
    await statuses(130, () => CREATE_EXPENSE(post("http://x/api/expenses", shared)));
    expect((await CREATE_EXPENSE(post("http://x/api/expenses", shared))).status).toBe(429); // person 1 is limited
    authState.user = { id: OTHER, email: "other@example.com" };
    expect((await CREATE_EXPENSE(post("http://x/api/expenses", shared))).status).not.toBe(429); // person 2 is not
  });

  it("a flood from one address is still stopped (the address guard is wide, not absent)", async () => {
    const flood = { "x-forwarded-for": "198.51.100.7" };
    let blocked = 0;
    for (let i = 0; i < 700; i++) {
      authState.user = { id: `user-${i % 50}`, email: `u${i % 50}@x.com` }; // 50 different people, one address
      if ((await CREATE_EXPENSE(post("http://x/api/expenses", flood))).status === 429) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThan(150); // only the excess beyond ~600 a minute
  });

  it("payments have their own per-person limit", async () => {
    const all = await statuses(121, () => CREATE_SETTLEMENT(post("http://x/api/settlements")));
    expect(all[120]).toBe(429);
    expect(all.slice(0, 120).every((s) => s !== 429)).toBe(true);
  });

  it("exporting everything is limited to a handful an hour (it reads all your data)", async () => {
    p.expense.findMany.mockResolvedValue([]);
    const all = await statuses(21, () => EXPORT(new NextRequest("http://x/api/export")));
    expect(all.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(all[20]).toBe(429);
  });
});

describe("invite link preview (public)", () => {
  const preview = (ip: string) => JOIN_PREVIEW(new NextRequest("http://x/api/join/tok", { headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ token: "tok" }) });

  it("is cached briefly by the CDN, so a crowd scanning one QR code costs one database read per half-minute, not hundreds", async () => {
    p.group.findFirst.mockResolvedValue({ id: "g", name: "Goa", _count: { members: 3, expenses: 2 } });
    const res = await preview("192.0.2.1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=60");
  });

  it("an unknown or expired link is never cached", async () => {
    p.group.findFirst.mockResolvedValue(null);
    const res = await preview("192.0.2.2");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("is limited per address (generously: a venue shares one), so link-guessing can't hammer the database", async () => {
    p.group.findFirst.mockResolvedValue(null);
    const all = await statuses(301, () => preview("192.0.2.3"));
    expect(all.slice(0, 300).every((s) => s === 404)).toBe(true);
    expect(all[300]).toBe(429);
    expect((await preview("192.0.2.4")).status).toBe(404); // another address is fine
  });
});
