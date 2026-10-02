import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET, PATCH, DELETE } from "@/app/api/expenses/[id]/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ID = "55555555-5555-4555-8555-555555555555";
const ctx = { params: Promise.resolve({ id: ID }) };
const patch = (b: unknown) => PATCH(new NextRequest(`http://x/api/expenses/${ID}`, { method: "PATCH", body: JSON.stringify(b) }), ctx);

const split = (userId: string, amount: number, extra = {}) => ({ userId, amount, percentage: null, shares: null, ...extra });
const existing = (over = {}) => ({
  id: ID, groupId: GROUP, amount: 30000, paidById: ME, splitType: "EQUAL", description: "Dinner",
  splits: [split(ME, 15000), split(OTHER, 15000)], ...over,
});

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
  p.groupMember.findUnique.mockResolvedValue({ userId: ME });
  p.expense.update.mockImplementation(async (args: { data: { description?: string } }) => ({ id: ID, description: args.data.description ?? "Dinner", groupId: GROUP }));
  p.notification.createMany.mockResolvedValue({});
  p.activity.create.mockResolvedValue({});
  p.user.findUnique.mockResolvedValue({ name: "Me" });
});

describe("expense visibility", () => {
  it("lets the payer open an expense they are not part of the split for", async () => {
    p.expense.findFirst.mockResolvedValue(existing({ splits: [split(OTHER, 30000)] }));
    expect((await GET(new NextRequest("http://x"), ctx)).status).toBe(200);
    expect(p.expense.findFirst.mock.calls[0][0].where.OR).toContainEqual({ paidById: ME });
  });

  it("404s for expenses the user can't see", async () => {
    p.expense.findFirst.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://x"), ctx)).status).toBe(404);
    expect((await patch({ description: "x" })).status).toBe(404);
    expect((await DELETE(new NextRequest("http://x"), ctx)).status).toBe(404);
  });
});

describe("PATCH — keeping splits consistent", () => {
  it("rebuilds equal splits when only the amount changes", async () => {
    p.expense.findFirst.mockResolvedValue(existing());
    expect((await patch({ amount: 400 })).status).toBe(200);
    const data = p.expense.update.mock.calls[0][0].data;
    expect(data.amount).toBe(40000);
    expect(data.splits.create.map((s: { amount: number }) => s.amount)).toEqual([20000, 20000]);
  });

  it("scales percentage splits from the stored percentages when the amount changes", async () => {
    p.expense.findFirst.mockResolvedValue(existing({
      splitType: "PERCENTAGE",
      splits: [split(ME, 21000, { percentage: 70 }), split(OTHER, 9000, { percentage: 30 })],
    }));
    await patch({ amount: 400 });
    const created = p.expense.update.mock.calls[0][0].data.splits.create;
    expect(created.map((s: { amount: number }) => s.amount)).toEqual([28000, 12000]);
    expect(created.map((s: { percentage: number }) => s.percentage)).toEqual([70, 30]);
  });

  it("asks for per-person amounts when an exact split's total changes", async () => {
    p.expense.findFirst.mockResolvedValue(existing({ splitType: "EXACT", splits: [split(ME, 20000), split(OTHER, 10000)] }));
    expect((await patch({ amount: 400 })).status).toBe(400);
    expect(p.expense.update).not.toHaveBeenCalled();
  });

  it("leaves splits untouched for edits that don't affect them", async () => {
    p.expense.findFirst.mockResolvedValue(existing());
    await patch({ description: "Dinner at Taj" });
    expect(p.expense.update.mock.calls[0][0].data).not.toHaveProperty("splits");
  });

  it("rejects participants outside the group", async () => {
    p.expense.findFirst.mockResolvedValue(existing());
    const res = await patch({ participants: [ME, STRANGER], splitType: "EQUAL" });
    expect(res.status).toBe(403);
    expect(p.expense.update).not.toHaveBeenCalled();
  });

  it("only the payer may edit a personal (non-group) expense", async () => {
    p.expense.findFirst.mockResolvedValue(existing({ groupId: null, paidById: OTHER }));
    expect((await patch({ description: "x" })).status).toBe(403);
  });
});
