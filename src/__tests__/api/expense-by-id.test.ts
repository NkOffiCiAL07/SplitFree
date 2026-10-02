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
  currency: "INR", category: "FOOD", date: new Date("2026-03-01"), notes: null, isRecurring: false, recurringInterval: null,
  payers: [] as { userId: string; amount: number }[],
  splits: [split(ME, 15000), split(OTHER, 15000)], ...over,
});

/** Make prisma.expense.update behave like the database: apply scalar edits and nested split/payer writes. */
function mockUpdateFrom(current: ReturnType<typeof existing>) {
  p.expense.update.mockImplementation(async ({ data }: { data: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { splits, payers, ...scalars } = data;
    const defined = Object.fromEntries(Object.entries(scalars).filter(([, v]) => v !== undefined));
    return {
      ...current, ...defined,
      splits: splits?.create ? splits.create.map((c: { userId: string; amount: number }) => split(c.userId, c.amount)) : current.splits,
      payers: payers ? (payers.create ?? []) : current.payers,
    };
  });
}

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.groupMember.findMany.mockResolvedValue([{ userId: ME }, { userId: OTHER }]);
  p.groupMember.findUnique.mockResolvedValue({ userId: ME });
  p.notification.createMany.mockResolvedValue({});
  p.activity.create.mockResolvedValue({});
  p.expenseRevision.create.mockResolvedValue({});
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
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    expect((await patch({ amount: 400 })).status).toBe(200);
    const data = p.expense.update.mock.calls[0][0].data;
    expect(data.amount).toBe(40000);
    expect(data.splits.create.map((s: { amount: number }) => s.amount)).toEqual([20000, 20000]);
  });

  it("scales percentage splits from the stored percentages when the amount changes", async () => {
    const cur = existing({
      splitType: "PERCENTAGE",
      splits: [split(ME, 21000, { percentage: 70 }), split(OTHER, 9000, { percentage: 30 })],
    });
    p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
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
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
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

describe("PATCH — multiple payers", () => {
  const twoPayers = [{ userId: ME, amount: 200 }, { userId: OTHER, amount: 100 }]; // major units, total ₹300

  it("switches a single-payer expense to multiple payers (primary payer = whoever paid most)", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    const res = await patch({ payers: [{ userId: OTHER, amount: 100 }, { userId: ME, amount: 200 }] });
    expect(res.status).toBe(200);
    const data = p.expense.update.mock.calls[0][0].data;
    expect(data.paidById).toBe(ME);
    expect(data.payers.deleteMany).toEqual({});
    expect(data.payers.create).toEqual([{ userId: OTHER, amount: 10000 }, { userId: ME, amount: 20000 }]);
  });

  it("rejects payers that don't add up to the total", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    const res = await patch({ payers: [{ userId: ME, amount: 200 }, { userId: OTHER, amount: 50 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/add up/i);
    expect(p.expense.update).not.toHaveBeenCalled();
  });

  it("rejects payers who are not in the group", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    const res = await patch({ payers: [{ userId: ME, amount: 150 }, { userId: STRANGER, amount: 150 }] });
    expect(res.status).toBe(403);
  });

  it("going back to a single payer clears the payer rows", async () => {
    const cur = existing({ payers: [{ userId: ME, amount: 20000 }, { userId: OTHER, amount: 10000 }] });
    p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    expect((await patch({ payers: null, paidById: ME })).status).toBe(200);
    const data = p.expense.update.mock.calls[0][0].data;
    expect(data.payers).toEqual({ deleteMany: {} });
    expect(data.paidById).toBe(ME);
  });

  it("requires the payers again when the total of a multi-payer expense changes", async () => {
    const cur = existing({ payers: [{ userId: ME, amount: 20000 }, { userId: OTHER, amount: 10000 }] });
    p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    expect((await patch({ amount: 400 })).status).toBe(400);
    expect(p.expense.update).not.toHaveBeenCalled();
  });

  it("lets any payer edit a personal expense, not just the primary one", async () => {
    const cur = existing({ groupId: null, paidById: OTHER, payers: [{ userId: OTHER, amount: 20000 }, { userId: ME, amount: 10000 }] });
    p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    expect((await patch({ description: "Renamed" })).status).toBe(200);
  });
});

describe("PATCH — edit history", () => {
  it("records what changed, before and after, with the editor", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    await patch({ description: "Dinner at Taj", category: "ENTERTAINMENT" });
    expect(p.expenseRevision.create).toHaveBeenCalledOnce();
    const row = p.expenseRevision.create.mock.calls[0][0].data;
    expect(row.expenseId).toBe(ID);
    expect(row.userId).toBe(ME);
    expect(row.changes).toEqual({
      description: { from: "Dinner", to: "Dinner at Taj" },
      category: { from: "FOOD", to: "ENTERTAINMENT" },
    });
  });

  it("does not record a revision when an edit changes nothing", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    await patch({ description: "Dinner" });
    expect(p.expenseRevision.create).not.toHaveBeenCalled();
  });

  it("records amount and payer changes", async () => {
    const cur = existing(); p.expense.findFirst.mockResolvedValue(cur); mockUpdateFrom(cur);
    await patch({ amount: 400 });
    const changes = p.expenseRevision.create.mock.calls[0][0].data.changes;
    expect(changes.amount).toEqual({ from: 30000, to: 40000 });
  });
});
