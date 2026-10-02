import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET } from "@/app/api/expenses/[id]/history/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ID = "55555555-5555-4555-8555-555555555555";
const call = () => GET(new NextRequest("http://x"), { params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
});

describe("GET /api/expenses/[id]/history", () => {
  it("requires sign-in and visibility of the expense", async () => {
    authState.user = null;
    expect((await call()).status).toBe(401);
    authState.user = { id: ME, email: "me@example.com" };
    p.expense.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(p.expenseRevision.findMany).not.toHaveBeenCalled();
  });

  it("returns revisions newest-first with the names of everyone mentioned", async () => {
    p.expense.findFirst.mockResolvedValue({ id: ID, currency: "INR" });
    p.expenseRevision.findMany.mockResolvedValue([
      { id: "r1", userId: OTHER, createdAt: new Date(), changes: {
        paidBy: { from: ME, to: OTHER },
        participants: { from: [ME], to: [ME, OTHER] },
        payers: { from: [], to: [{ userId: ME, amount: 100 }, { userId: OTHER, amount: 50 }] },
      } },
    ]);
    p.user.findMany.mockResolvedValue([{ id: ME, name: "Me", avatarUrl: null }, { id: OTHER, name: "Asha", avatarUrl: null }]);
    const res = await call();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(p.expenseRevision.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
    expect(data.currency).toBe("INR");
    expect(data.people).toEqual({ [ME]: "Me", [OTHER]: "Asha" });
    expect(data.revisions[0].editorId).toBe(OTHER);
    // everyone referenced in the change set (paidBy, participants, payers) is resolved in one lookup
    const asked = p.user.findMany.mock.calls[0][0].where.id.in;
    expect(new Set(asked)).toEqual(new Set([ME, OTHER]));
  });

  it("returns an empty list for an expense that was never edited", async () => {
    p.expense.findFirst.mockResolvedValue({ id: ID, currency: "INR" });
    p.expenseRevision.findMany.mockResolvedValue([]);
    const { data } = await (await call()).json();
    expect(data.revisions).toEqual([]);
    expect(data.people).toEqual({});
  });
});
