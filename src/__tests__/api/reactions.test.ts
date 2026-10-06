import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }) };
});

import { GET, POST } from "@/app/api/expenses/[id]/reactions/route";
import { GET as LIST } from "@/app/api/expenses/route";
import { REACTIONS, summarizeReactions } from "@/lib/reactions";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const EXP = "55555555-5555-4555-8555-555555555555";
const ctx = { params: Promise.resolve({ id: EXP }) };
const react = (emoji: unknown) => POST(new NextRequest("http://x", { method: "POST", body: JSON.stringify({ emoji }) }), ctx);

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.expense.findFirst.mockResolvedValue({ id: EXP });
  p.expenseReaction.findMany.mockResolvedValue([]);
  p.expenseReaction.findUnique.mockResolvedValue(null);
  p.expenseReaction.create.mockResolvedValue({});
  p.expenseReaction.deleteMany.mockResolvedValue({ count: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("summarizeReactions", () => {
  it("counts per emoji in the picker's order, and marks the ones that are yours", () => {
    const rows = [{ emoji: "🔥", userId: OTHER }, { emoji: "🍕", userId: ME }, { emoji: "🍕", userId: OTHER }, { emoji: "🔥", userId: "x" }];
    expect(summarizeReactions(rows, ME)).toEqual([{ emoji: "🍕", count: 2, mine: true }, { emoji: "🔥", count: 2, mine: false }]);
    expect(summarizeReactions([], ME)).toEqual([]);
  });
  it("offers eight emoji, all distinct", () => {
    expect(REACTIONS).toHaveLength(8);
    expect(new Set(REACTIONS).size).toBe(8);
  });
});

describe("POST /api/expenses/[id]/reactions (toggle)", () => {
  it("adds your reaction when you haven't given that emoji", async () => {
    p.expenseReaction.findMany.mockResolvedValue([{ emoji: "🍕", userId: ME }]);
    const res = await react("🍕");
    expect(res.status).toBe(200);
    expect(p.expenseReaction.create).toHaveBeenCalledWith({ data: { expenseId: EXP, userId: ME, emoji: "🍕" } });
    expect((await res.json()).data).toEqual([{ emoji: "🍕", count: 1, mine: true }]);
  });

  it("takes it back when you tap the same emoji again", async () => {
    p.expenseReaction.findUnique.mockResolvedValue({ id: "r1" });
    const res = await react("🍕");
    expect(p.expenseReaction.deleteMany).toHaveBeenCalledWith({ where: { expenseId: EXP, userId: ME, emoji: "🍕" } });
    expect(p.expenseReaction.create).not.toHaveBeenCalled();
    expect((await res.json()).data).toEqual([]);
  });

  it("only the fixed emoji are accepted — nothing free-form is stored", async () => {
    for (const bad of ["🦄", "hello", "", 5, null]) expect((await react(bad)).status, String(bad)).toBe(422);
    expect(p.expenseReaction.create).not.toHaveBeenCalled();
  });

  it("only people who can see the expense can react (looked up with the usual visibility rule)", async () => {
    p.expense.findFirst.mockResolvedValue(null);
    expect((await react("🔥")).status).toBe(404);
    expect(p.expense.findFirst.mock.calls[0][0].where).toMatchObject({ id: EXP, OR: expect.any(Array) });
    expect(p.expenseReaction.create).not.toHaveBeenCalled();
    authState.user = null;
    expect((await react("🔥")).status).toBe(401);
  });

  it("two quick taps at once don't error: the second just finds it already there", async () => {
    p.expenseReaction.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    expect((await react("😂")).status).toBe(200);
  });

  it("a real database failure is a 500 (not swallowed)", async () => {
    p.expenseReaction.create.mockRejectedValue(new Error("db down"));
    expect((await react("😂")).status).toBe(500);
  });

  it("is limited to 120 a minute per person", async () => {
    let last = 200;
    for (let i = 0; i < 121; i++) last = (await react("👍")).status;
    expect(last).toBe(429);
  });
});

describe("GET /api/expenses/[id]/reactions", () => {
  it("returns the summary for someone who can see the expense, 404 otherwise", async () => {
    p.expenseReaction.findMany.mockResolvedValue([{ emoji: "💸", userId: OTHER }]);
    const res = await GET(new NextRequest("http://x"), ctx);
    expect((await res.json()).data).toEqual([{ emoji: "💸", count: 1, mine: false }]);
    p.expense.findFirst.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://x"), ctx)).status).toBe(404);
  });
});

describe("expense lists carry their reactions (one extra query for the whole page)", () => {
  it("GET /api/expenses attaches reactions to every expense", async () => {
    p.$queryRaw.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    p.expense.findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    p.expenseReaction.findMany.mockResolvedValue([{ expenseId: "e1", emoji: "🍻", userId: ME }, { expenseId: "e1", emoji: "🍻", userId: OTHER }]);
    const { data } = await (await LIST(new NextRequest("http://x/api/expenses"))).json();
    expect(data[0].reactions).toEqual([{ emoji: "🍻", count: 2, mine: true }]);
    expect(data[1].reactions).toEqual([]);
    expect(p.expenseReaction.findMany).toHaveBeenCalledTimes(1);
    expect(p.expenseReaction.findMany.mock.calls[0][0].where).toEqual({ expenseId: { in: ["e1", "e2"] } });
  });

  it("paged lists too, and an empty list costs no extra query", async () => {
    p.expense.findMany.mockResolvedValue([]);
    const { data } = await (await LIST(new NextRequest("http://x/api/expenses?paged=true"))).json();
    expect(data).toEqual({ items: [], nextCursor: null });
    expect(p.expenseReaction.findMany).not.toHaveBeenCalled();
  });
});
