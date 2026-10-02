import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER, GROUP } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET, POST } from "@/app/api/settlements/route";
import { POST as REMIND } from "@/app/api/settlements/remind/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://x${url}`, init);
const json = (b: unknown) => ({ method: "POST", body: JSON.stringify(b) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
  p.user.findUnique.mockResolvedValue({ id: ME, name: "Me" });
});

describe("GET /api/settlements — group privacy", () => {
  it("refuses group data to non-members", async () => {
    p.groupMember.findUnique.mockResolvedValue(null);
    const res = await GET(req(`/api/settlements?groupId=${GROUP}&simplified=true`));
    expect(res.status).toBe(403);
    expect(p.expense.findMany).not.toHaveBeenCalled();
  });

  it("nets ALL group settlements, not only the caller's", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.settlement.findMany
      .mockResolvedValueOnce([]) // the caller's own page of settlements
      .mockResolvedValueOnce([{ fromUserId: OTHER, toUserId: STRANGER, amount: 500 }]); // someone else's payment
    p.expense.findMany.mockResolvedValue([
      { paidById: STRANGER, splits: [{ userId: OTHER, amount: 500, isPaid: false }, { userId: STRANGER, amount: 500, isPaid: false }] },
    ]);
    const res = await GET(req(`/api/settlements?groupId=${GROUP}&simplified=true`));
    const { data } = await res.json();
    expect(data.simplified).toEqual([]); // OTHER's debt to STRANGER was already paid by a third-party settlement
    expect(p.settlement.findMany.mock.calls[1][0].where).toEqual({ groupId: GROUP });
  });
});

describe("GET /api/settlements — group simplification per currency", () => {
  it("nets each currency separately and tags every payment", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.settlement.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    p.expense.findMany.mockResolvedValue([
      { paidById: ME, currency: "INR", splits: [{ userId: ME, amount: 500, isPaid: false }, { userId: OTHER, amount: 500, isPaid: false }] },
      { paidById: OTHER, currency: "USD", splits: [{ userId: ME, amount: 300, isPaid: false }, { userId: OTHER, amount: 300, isPaid: false }] },
    ]);
    const { data } = await (await GET(req(`/api/settlements?groupId=${GROUP}&simplified=true`))).json();
    expect(data.simplified).toHaveLength(2);
    expect(data.simplified).toContainEqual({ fromUserId: OTHER, toUserId: ME, amount: 500, currency: "INR" });
    expect(data.simplified).toContainEqual({ fromUserId: ME, toUserId: OTHER, amount: 300, currency: "USD" });
  });

  it("a payment in one currency does not cancel a debt in another", async () => {
    p.groupMember.findUnique.mockResolvedValue({ userId: ME });
    p.settlement.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ fromUserId: OTHER, toUserId: ME, amount: 500, currency: "USD" }]);
    p.expense.findMany.mockResolvedValue([
      { paidById: ME, currency: "INR", splits: [{ userId: OTHER, amount: 500, isPaid: false }] },
    ]);
    const { data } = await (await GET(req(`/api/settlements?groupId=${GROUP}&simplified=true`))).json();
    expect(data.simplified).toContainEqual({ fromUserId: OTHER, toUserId: ME, amount: 500, currency: "INR" });
  });
});

describe("POST /api/settlements — validation", () => {
  const valid = { toUserId: OTHER, amount: 100, currency: "INR" };

  it("rejects paying yourself", async () => {
    expect((await POST(req("/api/settlements", json({ ...valid, toUserId: ME })))).status).toBe(400);
  });

  it("requires both people to be in the group", async () => {
    p.groupMember.findUnique.mockResolvedValueOnce({ userId: ME }).mockResolvedValueOnce(null);
    const res = await POST(req("/api/settlements", json({ ...valid, groupId: GROUP })));
    expect(res.status).toBe(403);
    expect(p.settlement.create).not.toHaveBeenCalled();
  });

  it("rejects unknown recipients outside a group", async () => {
    p.friendship.findMany.mockResolvedValue([]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    expect((await POST(req("/api/settlements", json(valid)))).status).toBe(403);
  });

  it("records a payment in the debt's own currency", async () => {
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    p.settlement.create.mockResolvedValue({ id: "s1", fromUser: { name: "Me" }, toUser: { name: "Pal" } });
    p.notification.create.mockResolvedValue({});
    p.activity.create.mockResolvedValue({});
    const res = await POST(req("/api/settlements", json({ ...valid, currency: "USD", amount: 12.5 })));
    expect(res.status).toBe(201);
    const data = p.settlement.create.mock.calls[0][0].data;
    expect(data.currency).toBe("USD");
    expect(data.amount).toBe(1250);
  });
});

describe("POST /api/settlements/remind", () => {
  const valid = { debtorId: OTHER, amount: 5000, currency: "INR" };

  it("rejects reminding yourself and unknown users", async () => {
    expect((await REMIND(req("/api/settlements/remind", json({ ...valid, debtorId: ME })))).status).toBe(400);
    p.friendship.findMany.mockResolvedValue([]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    expect((await REMIND(req("/api/settlements/remind", json(valid)))).status).toBe(403);
  });

  it("sends a reminder, then blocks a second one within 24 hours", async () => {
    p.friendship.findMany.mockResolvedValue([{ friendId: OTHER }]);
    p.groupMember.findMany.mockResolvedValue([]);
    p.expenseSplit.findMany.mockResolvedValue([]);
    p.notification.findMany.mockResolvedValue([]);
    p.notification.create.mockResolvedValue({});

    const first = await REMIND(req("/api/settlements/remind", json(valid)));
    expect(first.status).toBe(201);
    expect(p.notification.create.mock.calls[0][0].data.type).toBe("PAYMENT_REMINDER");
    expect(p.notification.create.mock.calls[0][0].data.userId).toBe(OTHER);

    p.notification.findMany.mockResolvedValue([{ data: { fromUserId: ME } }]);
    const second = await REMIND(req("/api/settlements/remind", json(valid)));
    expect(second.status).toBe(429);
    expect(p.notification.create).toHaveBeenCalledTimes(1);
  });
});
