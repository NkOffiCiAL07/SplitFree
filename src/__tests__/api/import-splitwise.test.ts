import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { POST } from "@/app/api/import/splitwise/route";
import { resetRateLimits } from "@/lib/api-helpers";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const dinner = { date: "2026-01-05", description: "Dinner", category: "Dining out", cost: 90000, currency: "INR", isPayment: false, nets: { Me: 60000, Asha: -30000, Bhanu: -30000 } };
const payment = { date: "2026-01-09", description: "Payment", category: "Payment", cost: 30000, currency: "INR", isPayment: true, nets: { Asha: 30000, Me: -30000 } };
const THIRD = "66666666-6666-4666-8666-666666666666";

const send = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://x/api/import/splitwise", { method: "POST", body: JSON.stringify(body) }));

const valid = (over: Record<string, unknown> = {}) => ({
  groupId: GROUP, mapping: { Me: ME, Asha: OTHER, Bhanu: THIRD }, rows: [dinner], ...over,
});

beforeEach(() => {
  resetPrisma();
  resetRateLimits();
  authState.user = { id: ME + "", email: "me@example.com" };
  p.user.upsert.mockResolvedValue({});
  p.user.findUnique.mockResolvedValue({ id: ME });
  p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }, { userId: THIRD }]);
  p.group.findUnique.mockResolvedValue({ archivedAt: null });
  p.expense.findMany.mockResolvedValue([]);
  p.expense.create.mockImplementation(async ({ data }: { data: unknown }) => ({ data }));
  p.settlement.createMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/import/splitwise", () => {
  it("requires sign-in and a valid body", async () => {
    authState.user = null;
    expect((await send(valid())).status).toBe(401);
    authState.user = { id: ME, email: "me@example.com" };
    expect((await send({ groupId: GROUP, mapping: {}, rows: [] })).status).toBe(422);
    expect((await send(valid({ rows: [{ ...dinner, currency: "XYZ" }] }))).status).toBe(422);
    expect((await send(valid({ rows: [{ ...dinner, cost: -5 }] }))).status).toBe(422);
  });

  it("requires the caller to be one of the mapped people", async () => {
    const res = await send(valid({ mapping: { Me: OTHER, Asha: THIRD, Bhanu: STRANGER } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/map yourself/i);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("only imports into groups the caller belongs to, with only members mapped", async () => {
    p.groupMember.findMany.mockResolvedValue([{ userId: OTHER }, { userId: THIRD }]); // caller not a member
    expect((await send(valid())).status).toBe(403);
    p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]); // THIRD not a member
    expect((await send(valid())).status).toBe(403);
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("refuses to import into an archived group", async () => {
    p.group.findUnique.mockResolvedValue({ archivedAt: new Date() });
    expect((await send(valid())).status).toBe(409);
  });

  it("outside a group, everyone must be someone the caller already knows", async () => {
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    expect((await send(valid({ groupId: null }))).status).toBe(403); // THIRD unknown
  });

  it("creates expenses with exact splits that add up, plus settlements", async () => {
    const res = await send(valid({ rows: [dinner, payment] }));
    expect(res.status).toBe(201);
    const body = (await res.json()).data;
    expect(body).toMatchObject({ imported: 1, settlements: 1, duplicates: 0, skippedCount: 0 });

    const created = p.expense.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ groupId: GROUP, description: "Dinner", amount: 90000, currency: "INR", category: "FOOD", splitType: "EXACT", paidById: ME });
    expect(created).not.toHaveProperty("payers");
    expect(created.splits.create.reduce((a: number, s: { amount: number }) => a + s.amount, 0)).toBe(90000);

    const st = p.settlement.createMany.mock.calls[0][0].data[0];
    expect(st).toMatchObject({ fromUserId: OTHER, toUserId: ME, amount: 30000, currency: "INR", groupId: GROUP });
    expect(st.createdAt.toISOString().slice(0, 10)).toBe("2026-01-09");
  });

  it("keeps multiple payers", async () => {
    const multi = { ...dinner, description: "Hotel", cost: 100000, nets: { Me: 30000, Asha: 20000, Bhanu: -50000 } };
    await send(valid({ rows: [multi] }));
    const created = p.expense.create.mock.calls[0][0].data;
    expect(created.payers.create).toEqual([{ userId: ME, amount: 55000 }, { userId: OTHER, amount: 45000 }]);
  });

  it("is idempotent: rows that already exist are skipped, not duplicated", async () => {
    p.expense.findMany.mockResolvedValue([{ description: "Dinner", amount: 90000, date: new Date("2026-01-05T12:00:00Z"), paidById: ME }]);
    const res = await send(valid());
    expect((await res.json()).data).toMatchObject({ imported: 0, duplicates: 1 });
    expect(p.expense.create).not.toHaveBeenCalled();
  });

  it("de-duplicates identical rows inside the same file too", async () => {
    const res = await send(valid({ rows: [dinner, dinner] }));
    expect((await res.json()).data).toMatchObject({ imported: 1, duplicates: 1 });
  });

  it("reports rows it couldn't convert instead of failing the whole import", async () => {
    const bad = { ...dinner, description: "Broken", nets: { Me: 5000, Asha: -100 } }; // doesn't add up
    const res = await send(valid({ rows: [dinner, bad] }));
    const body = (await res.json()).data;
    expect(body.imported).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(body.skipped[0]).toMatch(/Broken/);
  });

  it("limits how often a user can import", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await send(valid({ rows: [{ ...dinner, description: `D${i}` }] }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
