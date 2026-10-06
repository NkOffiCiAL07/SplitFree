import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return {
    createClient: async () => ({ auth: { getClaims: async () => ({ data: authState.user ? { claims: { sub: authState.user.id, email: authState.user.email } } : null, error: null }) } }),
    createAdminClient: async () => ({ auth: { admin: { deleteUser } } }),
  };
});

import { DELETE } from "@/app/api/account/route";
import { GET as EXPORT } from "@/app/api/account/export/route";
import { ensureUserProfile, resetKnownUsers, resetRateLimits } from "@/lib/api-helpers";
import { balanceBlockers, deletedEmail, isDeletedAccount, DELETED_NAME } from "@/lib/account";
import { buildEdges } from "@/lib/ledger";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const del = (body: unknown = { confirmEmail: "me@example.com" }) =>
  DELETE(new NextRequest("http://x/api/account", { method: "DELETE", body: JSON.stringify(body), headers: { "x-forwarded-for": "7.7.7.7" } }));

/** A user with no money with anybody (unless a test seeds some). */
function seedLedger(expenses: unknown[] = [], settlements: unknown[] = []) {
  p.expense.findMany.mockResolvedValue(expenses);
  p.settlement.findMany.mockResolvedValue(settlements);
  p.user.findMany.mockResolvedValue([{ id: OTHER, name: "Asha", avatarUrl: null, upiId: null }]);
}

beforeEach(() => {
  resetPrisma(); resetKnownUsers(); resetRateLimits(); deleteUser.mockReset();
  deleteUser.mockResolvedValue({ error: null });
  authState.user = { id: ME, email: "me@example.com" };
  p.groupMember.findMany.mockResolvedValue([]);
  seedLedger();
});

describe("account helpers", () => {
  it("anonymised accounts are recognisable and can never be a real address", () => {
    expect(deletedEmail("abc")).toBe("deleted-abc@deleted.invalid");
    expect(isDeletedAccount(deletedEmail("abc"))).toBe(true);
    expect(isDeletedAccount("Someone@Deleted.Invalid")).toBe(true);
    expect(isDeletedAccount("me@example.com")).toBe(false);
    expect(isDeletedAccount(null)).toBe(false);
  });

  it("blockers list every non-zero balance per person and currency, and nothing once settled", () => {
    const e = (paidById: string, userId: string, amount: number, currency: string) =>
      ({ paidById, currency, amount, splits: [{ userId, amount }] });
    const edges = buildEdges([e(ME, OTHER, 500, "INR"), e(OTHER, ME, 100, "USD")], []);
    expect(balanceBlockers(edges, ME).sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
      { userId: OTHER, currency: "INR", net: 500 },
      { userId: OTHER, currency: "USD", net: -100 },
    ]);
    const settled = buildEdges([e(ME, OTHER, 500, "INR")], [{ fromUserId: OTHER, toUserId: ME, amount: 500, currency: "INR" }]);
    expect(balanceBlockers(settled, ME)).toEqual([]);
  });
});

describe("DELETE /api/account — safety", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await del()).status).toBe(401);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it.each([
    ["no confirmation", {}],
    ["the wrong email", { confirmEmail: "someone@else.com" }],
    ["a non-string", { confirmEmail: 5 }],
  ])("refuses with %s and changes nothing", async (_n, body) => {
    expect((await del(body)).status).toBe(400);
    expect(p.user.update).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("accepts the email in any case, with stray spaces", async () => {
    expect((await del({ confirmEmail: "  ME@Example.com " })).status).toBe(200);
  });

  it("is refused (409) while you still owe or are owed money, naming who — and NOTHING is touched", async () => {
    seedLedger([{ id: "e", paidById: ME, currency: "INR", amount: 500, groupId: null, payers: [], splits: [{ userId: OTHER, amount: 500 }] }]);
    const res = await del();
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.message).toMatch(/settle up/i);
    expect(json.blockers).toEqual([{ userId: OTHER, currency: "INR", net: 500, name: "Asha" }]);
    for (const m of ["groupMember", "friendship", "notification", "budget", "expenseComment", "activity"]) {
      expect(p[m].deleteMany, m).not.toHaveBeenCalled();
    }
    expect(p.user.update).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("a debt in ANY currency blocks it (₹ settled doesn't excuse a $ debt)", async () => {
    seedLedger(
      [{ id: "e1", paidById: ME, currency: "INR", amount: 500, groupId: null, payers: [], splits: [{ userId: OTHER, amount: 500 }] },
       { id: "e2", paidById: OTHER, currency: "USD", amount: 100, groupId: null, payers: [], splits: [{ userId: ME, amount: 100 }] }],
      [{ fromUserId: OTHER, toUserId: ME, amount: 500, currency: "INR", groupId: null }]
    );
    const res = await del();
    expect(res.status).toBe(409);
    expect((await res.json()).blockers).toEqual([expect.objectContaining({ currency: "USD", net: -100 })]);
  });

  it("is rate limited", async () => {
    for (let i = 0; i < 5; i++) await del({ confirmEmail: "no" });
    expect((await del({ confirmEmail: "no" })).status).toBe(429);
  });
});

describe("DELETE /api/account — when everything is settled", () => {
  it("anonymises the profile, removes personal data, and deletes the sign-in", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ deleted: true });

    expect(p.user.update).toHaveBeenCalledWith({
      where: { id: ME },
      data: { name: DELETED_NAME, email: deletedEmail(ME), avatarUrl: null, upiId: null, phone: null, emailNotifications: false },
    });
    for (const m of ["groupMember", "notification", "pushSubscription", "budget", "expenseComment", "expenseReaction", "activity"]) {
      expect(p[m].deleteMany, m).toHaveBeenCalledWith({ where: { userId: ME } });
    }
    expect(p.friendship.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ userId: ME }, { friendId: ME }] } });
    expect(p.groupInvite.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ invitedBy: ME }, { email: "me@example.com" }] } });
    expect(deleteUser).toHaveBeenCalledWith(ME);
  });

  it("NEVER deletes the user row or any shared money record (other people's history must survive)", async () => {
    await del();
    expect(p.user.delete).not.toHaveBeenCalled();
    for (const m of ["expense", "expenseSplit", "expensePayer", "settlement", "expenseRevision", "group"]) {
      expect(p[m].delete, m).not.toHaveBeenCalled();
      expect(p[m].deleteMany, m).not.toHaveBeenCalled();
    }
  });

  it("hands group admin to the longest-standing member when you were the only admin", async () => {
    p.groupMember.findMany
      .mockResolvedValueOnce([{ groupId: GROUP, role: "ADMIN" }])                       // my memberships
      .mockResolvedValueOnce([{ id: "m-asha", role: "MEMBER" }, { id: "m-bob", role: "MEMBER" }]); // the others, oldest first
    await del();
    expect(p.groupMember.update).toHaveBeenCalledWith({ where: { id: "m-asha" }, data: { role: "ADMIN" } });
    expect(p.group.update).not.toHaveBeenCalled();
  });

  it("leaves admin alone when another admin remains, or when you weren't one", async () => {
    p.groupMember.findMany
      .mockResolvedValueOnce([{ groupId: GROUP, role: "ADMIN" }, { groupId: "g2", role: "MEMBER" }])
      .mockResolvedValueOnce([{ id: "m1", role: "ADMIN" }])
      .mockResolvedValueOnce([{ id: "m2", role: "MEMBER" }]);
    await del();
    expect(p.groupMember.update).not.toHaveBeenCalled();
  });

  it("archives (never deletes) a group nobody else is left in", async () => {
    p.groupMember.findMany.mockResolvedValueOnce([{ groupId: GROUP, role: "ADMIN" }]).mockResolvedValueOnce([]);
    await del();
    expect(p.group.update).toHaveBeenCalledWith({ where: { id: GROUP }, data: { archivedAt: expect.any(Date) } });
    expect(p.group.delete).not.toHaveBeenCalled();
  });

  it("can be repeated: if closing the sign-in failed, calling again finishes and a missing user is fine", async () => {
    deleteUser.mockResolvedValueOnce({ error: { message: "network down" } });
    const first = await del();
    expect(first.status).toBe(500);
    expect((await first.json()).error.message).toMatch(/try again/i);

    deleteUser.mockResolvedValueOnce({ error: { message: "User not found" } }); // already gone: success
    expect((await del()).status).toBe(200);
  });

  it("a thrown error while closing the sign-in is also reported, not swallowed", async () => {
    deleteUser.mockRejectedValueOnce(new Error("boom"));
    expect((await del()).status).toBe(500);
  });

  it("if the database step fails, the sign-in is NOT deleted (no half-deleted account)", async () => {
    p.user.update.mockRejectedValue(new Error("db down"));
    expect((await del()).status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("a deleted account can't keep acting on a still-valid sign-in token", () => {
  it("ensureUserProfile refuses an anonymised account (the writes behind it stop with 401)", async () => {
    p.user.findUnique.mockResolvedValue({ id: ME, email: deletedEmail(ME) });
    await expect(ensureUserProfile(ME, "me@example.com")).rejects.toMatchObject({ name: "AccountDeletedError" });
  });

  it("…and a write route turns that into a 401", async () => {
    const { POST } = await import("@/app/api/expenses/route");
    p.user.findUnique.mockResolvedValue({ id: ME, email: deletedEmail(ME) });
    const res = await POST(new NextRequest("http://x/api/expenses", { method: "POST", body: JSON.stringify({ description: "x" }), headers: { "x-forwarded-for": "8.8.8.8" } }));
    expect(res.status).toBe(401);
    expect(p.expense.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/account/export", () => {
  beforeEach(() => {
    p.user.findUnique.mockResolvedValue({ id: ME, email: "me@example.com", name: "Me", currency: "INR", timezone: "UTC", upiId: "me@okaxis", createdAt: new Date("2026-01-01") });
    p.groupMember.findMany.mockResolvedValue([{ role: "ADMIN", joinedAt: new Date("2026-01-02"), group: { id: GROUP, name: "Goa", currency: "INR", category: "TRIP", createdAt: new Date(), archivedAt: null } }]);
    p.expense.findMany.mockResolvedValue([{
      id: "e1", description: "Dinner", amount: 125050, currency: "INR", category: "FOOD", date: new Date("2026-03-01"), notes: null, groupId: GROUP, paidById: ME, splitType: "EQUAL",
      splits: [{ userId: ME, amount: 62525 }, { userId: OTHER, amount: 62525 }], payers: [],
    }]);
    p.settlement.findMany.mockResolvedValue([{ id: "s1", fromUserId: OTHER, toUserId: ME, amount: 10000, currency: "INR", groupId: GROUP, note: null, createdAt: new Date() }]);
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER, createdAt: new Date() }]);
    p.expenseComment.findMany.mockResolvedValue([{ expenseId: "e1", text: "yum", createdAt: new Date() }]);
    p.budget.findMany.mockResolvedValue([{ groupId: GROUP, category: null, period: "MONTHLY", amount: 500000 }]);
    p.user.findMany.mockResolvedValue([{ id: ME, name: "Me" }, { id: OTHER, name: "Asha" }]);
  });

  it("requires sign-in", async () => {
    authState.user = null;
    expect((await EXPORT()).status).toBe(401);
  });

  it("downloads everything as one JSON file, amounts in normal units", async () => {
    const res = await EXPORT();
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="splitr-pro-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    const j = JSON.parse(await res.text());
    expect(j.profile).toMatchObject({ email: "me@example.com", upiId: "me@okaxis" });
    expect(j.expenses[0]).toMatchObject({ amount: 1250.5, splits: [{ userId: ME, amount: 625.25 }, { userId: OTHER, amount: 625.25 }] });
    expect(j.settlements[0].amount).toBe(100);
    expect(j.budgets[0].amount).toBe(5000);
    expect(j.groups[0]).toMatchObject({ name: "Goa", yourRole: "ADMIN" });
    expect(j.yourComments[0].text).toBe("yum");
  });

  it("names other people but never exposes their emails", async () => {
    const j = JSON.parse(await (await EXPORT()).text());
    expect(j.people).toEqual({ [ME]: "Me", [OTHER]: "Asha" });
    expect(JSON.stringify(j)).not.toMatch(/asha@/i);
    expect(p.user.findMany.mock.calls[0][0].select).toEqual({ id: true, name: true });
  });

  it("only exports what the person can see (their own expenses/payments)", async () => {
    await EXPORT();
    expect(p.expense.findMany.mock.calls[0][0].where).toHaveProperty("id.in"); // only what the person can see (ids found through the indexes)
    expect(p.settlement.findMany.mock.calls[0][0].where).toEqual({ OR: [{ fromUserId: ME }, { toUserId: ME }] });
    expect(p.expenseComment.findMany.mock.calls[0][0].where).toEqual({ userId: ME });
    void STRANGER;
  });
});
