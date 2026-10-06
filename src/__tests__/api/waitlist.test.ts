import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "@/app/api/waitlist/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const post = (body: unknown, ip = "198.51.100.1") => POST(new NextRequest("http://x/api/waitlist", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }));

beforeEach(() => { resetPrisma(); p.waitlistEntry.upsert.mockResolvedValue({}); });

describe("POST /api/waitlist (iPhone launch list)", () => {
  it("stores the address, lower-cased and trimmed, for iOS", async () => {
    const res = await post({ email: "  Asha@Example.COM " });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ joined: true });
    expect(p.waitlistEntry.upsert).toHaveBeenCalledWith({ where: { email: "asha@example.com" }, update: {}, create: { email: "asha@example.com", platform: "ios" } });
  });

  it("is idempotent and never reveals whether an address was already on the list", async () => {
    const a = await (await post({ email: "same@example.com" })).json();
    const b = await (await post({ email: "same@example.com" })).json();
    expect(b).toEqual(a);
    expect(p.waitlistEntry.upsert.mock.calls[0][0].update).toEqual({}); // an existing row is left exactly as it was
  });

  it("refuses things that aren't an email", async () => {
    for (const email of ["", "nope", "a@b", "x".repeat(300) + "@example.com"]) expect((await post({ email })).status, email).toBe(422);
    expect((await post({})).status).toBe(422);
    expect(p.waitlistEntry.upsert).not.toHaveBeenCalled();
  });

  it("a bot that fills the hidden field is told it worked, and nothing is stored", async () => {
    const res = await post({ email: "bot@example.com", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(p.waitlistEntry.upsert).not.toHaveBeenCalled();
  });

  it("limits junk: 20 sign-ups an hour per address, then a polite 429 — another address is unaffected", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) codes.push((await post({ email: `u${i}@example.com` }, "203.0.113.77")).status);
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true);
    expect(codes[20]).toBe(429);
    expect((await post({ email: "other@example.com" }, "203.0.113.78")).status).toBe(200);
  });
});
