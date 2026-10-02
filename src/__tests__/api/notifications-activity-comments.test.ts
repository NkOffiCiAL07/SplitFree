import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrisma, authState, ME, OTHER, STRANGER } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", async () => {
  const { authState } = await import("./helpers");
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) } }) };
});

import { GET as LIST_NOTIFS, PATCH as MARK_READ } from "@/app/api/notifications/route";
import { GET as ACTIVITY } from "@/app/api/activity/route";
import { GET as LIST_COMMENTS, POST as ADD_COMMENT, DELETE as DELETE_COMMENT } from "@/app/api/expenses/[id]/comments/route";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const EXP = "55555555-5555-4555-8555-555555555555";
const ctx = { params: Promise.resolve({ id: EXP }) };
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://x${url}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => {
  resetPrisma();
  authState.user = { id: ME, email: "me@example.com" };
});

describe("GET /api/notifications", () => {
  it("requires sign-in", async () => {
    authState.user = null;
    expect((await LIST_NOTIFS(req("/api/notifications"))).status).toBe(401);
  });

  it("returns only the caller's notifications, newest first, never cached", async () => {
    p.notification.findMany.mockResolvedValue([{ id: "n1" }]);
    const res = await LIST_NOTIFS(req("/api/notifications"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const args = p.notification.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: ME });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(20);
  });

  it("clamps and sanitises the limit, and supports cursor paging", async () => {
    p.notification.findMany.mockResolvedValue([]);
    await LIST_NOTIFS(req("/api/notifications?limit=9999"));
    await LIST_NOTIFS(req("/api/notifications?limit=abc&cursor=n5"));
    expect(p.notification.findMany.mock.calls[0][0].take).toBe(100);
    expect(p.notification.findMany.mock.calls[1][0].take).toBe(20);
    expect(p.notification.findMany.mock.calls[1][0]).toMatchObject({ skip: 1, cursor: { id: "n5" } });
  });
});

describe("PATCH /api/notifications (mark as read)", () => {
  it("marks everything read — but only the caller's", async () => {
    p.notification.updateMany.mockResolvedValue({});
    expect((await MARK_READ(req("/api/notifications", "PATCH", { markAll: true }))).status).toBe(200);
    expect(p.notification.updateMany.mock.calls[0][0]).toEqual({ where: { userId: ME }, data: { isRead: true } });
  });

  it("marks specific ids read, scoped to the caller so others' notifications can't be touched", async () => {
    p.notification.updateMany.mockResolvedValue({});
    await MARK_READ(req("/api/notifications", "PATCH", { ids: ["a", "b"] }));
    expect(p.notification.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ["a", "b"] }, userId: ME });
  });

  it("does nothing for an empty request", async () => {
    expect((await MARK_READ(req("/api/notifications", "PATCH", {}))).status).toBe(200);
    expect(p.notification.updateMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/activity", () => {
  const date = (d: string) => new Date(d);

  it("requires sign-in", async () => {
    authState.user = null;
    expect((await ACTIVITY(req("/api/activity"))).status).toBe(401);
  });

  it("merges activity and notifications into one feed, newest first, with friendly titles", async () => {
    p.activity.findMany.mockResolvedValue([
      { id: "a1", type: "EXPENSE_CREATED", metadata: { groupName: "Goa" }, createdAt: date("2026-03-02"), group: { id: "g", name: "Goa" }, expense: { description: "Dinner" } },
    ]);
    p.notification.findMany.mockResolvedValue([
      { id: "n1", type: "PAYMENT_REMINDER", title: "Reminder", body: "Pay up", isRead: false, createdAt: date("2026-03-03"), data: null },
    ]);
    const { data } = await (await ACTIVITY(req("/api/activity"))).json();
    expect(data.map((x: { id: string }) => x.id)).toEqual(["notif_n1", "act_a1"]);
    expect(data[1]).toMatchObject({ source: "activity", title: "You added an expense", body: "Dinner · Goa · Goa", isRead: true });
    expect(data[0]).toMatchObject({ source: "notification", isRead: false, title: "Reminder" });
  });

  it("scopes both queries to the caller", async () => {
    p.activity.findMany.mockResolvedValue([]);
    p.notification.findMany.mockResolvedValue([]);
    await ACTIVITY(req("/api/activity"));
    expect(p.activity.findMany.mock.calls[0][0].where).toEqual({ userId: ME });
    expect(p.notification.findMany.mock.calls[0][0].where).toEqual({ userId: ME });
  });

  it("survives a garbage limit (used to become NaN) and caps the feed length", async () => {
    p.activity.findMany.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, type: "GROUP_CREATED", metadata: null, createdAt: date("2026-01-01"), group: null, expense: null })));
    p.notification.findMany.mockResolvedValue([]);
    const res = await ACTIVITY(req("/api/activity?limit=abc"));
    expect(res.status).toBe(200);
    expect(p.activity.findMany.mock.calls[0][0].take).toBe(30);
    const { data } = await (await ACTIVITY(req("/api/activity?limit=2"))).json();
    expect(data).toHaveLength(2);
  });

  it("falls back to the raw type for unknown activity types", async () => {
    p.activity.findMany.mockResolvedValue([{ id: "a", type: "SOMETHING_NEW", metadata: null, createdAt: date("2026-01-01"), group: null, expense: null }]);
    p.notification.findMany.mockResolvedValue([]);
    const { data } = await (await ACTIVITY(req("/api/activity"))).json();
    expect(data[0].title).toBe("SOMETHING_NEW");
  });
});

describe("expense comments", () => {
  describe("GET", () => {
    it("404s for expenses the user can't see, otherwise lists comments oldest first", async () => {
      p.expense.findFirst.mockResolvedValue(null);
      expect((await LIST_COMMENTS(req("/x"), ctx)).status).toBe(404);
      expect(p.expenseComment.findMany).not.toHaveBeenCalled();

      p.expense.findFirst.mockResolvedValue({ id: EXP });
      p.expenseComment.findMany.mockResolvedValue([{ id: "c1" }]);
      expect((await LIST_COMMENTS(req("/x"), ctx)).status).toBe(200);
      expect(p.expenseComment.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "asc" });
    });
  });

  describe("POST", () => {
    const setup = () => {
      p.expense.findFirst.mockResolvedValue({ id: EXP, description: "Dinner", groupId: "g1", paidBy: { name: "Asha" }, group: { name: "Goa" } });
      p.expenseComment.create.mockResolvedValue({ id: "c1", text: "hi" });
      p.expenseSplit.findMany.mockResolvedValue([{ userId: OTHER }, { userId: STRANGER }]);
      p.user.findUnique.mockResolvedValue({ name: "Me" });
      p.notification.createMany.mockResolvedValue({});
    };
    const post = (body: unknown) => ADD_COMMENT(req("/x", "POST", body), ctx);

    it("requires sign-in and an expense the user can see", async () => {
      authState.user = null;
      expect((await post({ text: "hi" })).status).toBe(401);
      authState.user = { id: ME, email: "me@example.com" };
      p.expense.findFirst.mockResolvedValue(null);
      expect((await post({ text: "hi" })).status).toBe(404);
    });

    it("rejects empty, whitespace-only and non-string comments", async () => {
      setup();
      for (const text of ["", "   ", undefined, 42, null, {}]) {
        expect((await post({ text })).status).toBe(400);
      }
      expect(p.expenseComment.create).not.toHaveBeenCalled();
    });

    it("rejects comments over 1000 characters but accepts exactly 1000", async () => {
      setup();
      expect((await post({ text: "x".repeat(1001) })).status).toBe(400);
      expect((await post({ text: "x".repeat(1000) })).status).toBe(201);
    });

    it("saves the trimmed text and notifies every other participant", async () => {
      setup();
      const res = await post({ text: "  nice one  " });
      expect(res.status).toBe(201);
      expect(p.expenseComment.create.mock.calls[0][0].data).toEqual({ expenseId: EXP, userId: ME, text: "nice one" });
      const notified = p.notification.createMany.mock.calls[0][0].data;
      expect(notified.map((n: { userId: string }) => n.userId)).toEqual([OTHER, STRANGER]);
      expect(notified[0]).toMatchObject({ type: "EXPENSE_COMMENTED", title: "Me commented on an expense" });
      expect(notified[0].body).toContain("nice one");
      expect(p.expenseSplit.findMany.mock.calls[0][0].where).toEqual({ expenseId: EXP, userId: { not: ME } }); // never notifies yourself
    });

    it("truncates long comments in the notification body", async () => {
      setup();
      await post({ text: "y".repeat(500) });
      expect(p.notification.createMany.mock.calls[0][0].data[0].body.length).toBeLessThan(120);
    });

    it("skips notifications when nobody else is in the expense", async () => {
      setup();
      p.expenseSplit.findMany.mockResolvedValue([]);
      await post({ text: "note to self" });
      expect(p.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    const del = (body: unknown) => DELETE_COMMENT(req("/x", "DELETE", body), ctx);

    it("requires a commentId (an undefined id used to match the caller's first comment)", async () => {
      for (const body of [{}, { commentId: null }, { commentId: "" }, { commentId: 5 }]) {
        expect((await del(body)).status).toBe(400);
      }
      expect(p.expenseComment.findFirst).not.toHaveBeenCalled();
      expect(p.expenseComment.delete).not.toHaveBeenCalled();
    });

    it("only lets authors delete their own comment on this expense", async () => {
      p.expenseComment.findFirst.mockResolvedValue(null);
      expect((await del({ commentId: "c9" })).status).toBe(404);
      expect(p.expenseComment.findFirst.mock.calls[0][0].where).toEqual({ id: "c9", expenseId: EXP, userId: ME });
      expect(p.expenseComment.delete).not.toHaveBeenCalled();
    });

    it("deletes the caller's comment", async () => {
      p.expenseComment.findFirst.mockResolvedValue({ id: "c1" });
      p.expenseComment.delete.mockResolvedValue({});
      expect((await del({ commentId: "c1" })).status).toBe(200);
      expect(p.expenseComment.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });
  });
});
