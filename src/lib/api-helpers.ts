import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export async function ensureUserProfile(userId: string, email: string, name?: string) {
  // Cheap indexed read on the hot path; only write for first-time users.
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      name: name ?? email.split("@")[0],
      currency: DEFAULT_CURRENCY, // DB default is USD; most users are in India
    },
  });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err((e as ZodError).issues.map((x) => x.message).join(", "), 422);
  }
  console.error(e);
  return err(e instanceof Error ? e.message : "Internal server error", 500);
}

/** Expenses a user may see/modify: they are in the split OR they paid (alone or as one of several payers). */
export function visibleToUser(userId: string) {
  return { OR: [{ splits: { some: { userId } } }, { paidById: userId }, { payers: { some: { userId } } }] };
}

export async function isGroupMember(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { userId: true },
  });
  return !!m;
}

/** True when the group exists and has been archived (read-only history). */
export async function isGroupArchived(groupId: string) {
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { archivedAt: true } });
  return !!g?.archivedAt;
}

export const ARCHIVED_MESSAGE = "This group is archived. Restore it to make changes.";

/**
 * IDs the user is allowed to involve in an expense/settlement outside a group:
 * themselves, accepted friends, people sharing any group, and anyone they already
 * share an expense with. Prevents attaching debts/notifications to arbitrary users.
 */
export async function getKnownUserIds(userId: string): Promise<Set<string>> {
  const [friends, coMembers, expenseMates] = await Promise.all([
    prisma.friendship.findMany({ where: { userId, status: "ACCEPTED" }, select: { friendId: true } }),
    prisma.groupMember.findMany({
      where: { group: { members: { some: { userId } } } },
      select: { userId: true },
    }),
    prisma.expenseSplit.findMany({
      where: { expense: visibleToUser(userId) },
      select: { userId: true, expense: { select: { paidById: true } } },
      distinct: ["userId"],
      take: 500,
    }),
  ]);
  const ids = new Set<string>([userId]);
  friends.forEach((f) => ids.add(f.friendId));
  coMembers.forEach((m) => ids.add(m.userId));
  expenseMates.forEach((e) => { ids.add(e.userId); ids.add(e.expense.paidById); });
  return ids;
}

export function parseLimit(raw: string | null, def = 50, max = 100) {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
}

/** First hop of x-forwarded-for (the header can be a comma-separated list). */
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Simple in-memory rate limiter per IP (resets on cold start)
const ipMap = new Map<string, { count: number; reset: number }>();

/** Test hook: forget all rate-limit counters. */
export function resetRateLimits() {
  ipMap.clear();
}

export function rateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.reset) {
    ipMap.set(ip, { count: 1, reset: now + windowMs });
    return false; // not limited
  }
  if (entry.count >= limit) return true; // limited
  entry.count++;
  return false;
}
