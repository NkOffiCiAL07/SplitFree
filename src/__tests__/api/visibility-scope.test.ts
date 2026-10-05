import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrisma, ME } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { visibleExpenseIds, visibleScope, visibleToUser } from "@/lib/api-helpers";
import { loadUserLedger } from "@/lib/ledger-db";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(resetPrisma);

describe("which expenses a person can see (looked up through the indexes)", () => {
  it("returns the ids found, de-duplicated by the database", async () => {
    p.$queryRaw.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    expect(await visibleExpenseIds(ME)).toEqual(["a", "b"]);
    expect(p.$queryRaw).toHaveBeenCalledTimes(1); // one round trip
  });

  it("becomes an `id IN (…)` filter for lists and totals", async () => {
    p.$queryRaw.mockResolvedValue([{ id: "a" }]);
    expect(await visibleScope(ME)).toEqual({ id: { in: ["a"] } });
  });

  it("someone involved in nothing sees nothing (an empty list, not everything)", async () => {
    p.$queryRaw.mockResolvedValue([]);
    expect(await visibleScope(ME)).toEqual({ id: { in: [] } });
  });

  it("with an enormous history it falls back to the always-correct filter instead of a giant IN list", async () => {
    p.$queryRaw.mockResolvedValue(Array.from({ length: 20_001 }, (_, i) => ({ id: `e${i}` })));
    expect(await visibleScope(ME)).toEqual(visibleToUser(ME));
    p.$queryRaw.mockResolvedValue(Array.from({ length: 20_000 }, (_, i) => ({ id: `e${i}` })));
    expect(((await visibleScope(ME)) as { id: { in: string[] } }).id.in).toHaveLength(20_000);
  });

  it("the single-expense checks keep the simple filter (looking one row up by id is already instant)", () => {
    expect(visibleToUser(ME).OR).toHaveLength(3);
  });

  it("balances are computed from exactly those expenses", async () => {
    p.$queryRaw.mockResolvedValue([{ id: "e1" }]);
    p.expense.findMany.mockResolvedValue([]);
    p.settlement.findMany.mockResolvedValue([]);
    await loadUserLedger(ME);
    expect(p.expense.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["e1"] } });
  });
});

describe("expense responses carry only what the screens use", () => {
  it("people are id, name and avatar only — no email, no UPI id, no phone — and the group has no invite token", async () => {
    const { expenseResponseInclude, expensePeople, expenseGroup } = await import("@/lib/api-helpers");
    expect(expensePeople.select).toEqual({ id: true, name: true, avatarUrl: true });
    expect(expenseGroup.select).toEqual({ id: true, name: true, currency: true, category: true });
    expect(expenseResponseInclude.paidBy).toBe(expensePeople);
    expect(expenseResponseInclude.splits.include.user).toBe(expensePeople);
    expect(expenseResponseInclude.payers.include.user).toBe(expensePeople);
    expect(JSON.stringify(expenseResponseInclude)).not.toMatch(/email|upiId|phone|inviteToken/);
  });

  it("no expense endpoint asks for whole user or group rows (`user: true` / `group: true`)", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/app/api/expenses/route.ts", "src/app/api/expenses/[id]/route.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/user: true|group: true|paidBy: true\s*[,}]\s*(splits|payers)/);
    }
  });
});
