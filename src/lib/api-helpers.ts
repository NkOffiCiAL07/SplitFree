import { SplitError } from "@/lib/algorithms/debt-simplification";
import { AccountDeletedError, isDeletedAccount } from "@/lib/account";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { rateLimit as slidingWindow, resetRateLimits as resetWindows } from "@/lib/rate-limit";
import { ZodError } from "zod";

/** The signed-in user as far as the API needs to know. name/phone come from what they entered at sign-up (used once, when their profile is first created). */
export interface AuthUser { id: string; email: string | undefined; name?: string; phone?: string }

/**
 * Verifies the session's access token locally against Supabase's cached public signing keys (ES256)
 * instead of asking the auth server on every request — that network round trip used to be added to
 * every API call. An expired token is refreshed transparently; a session revoked elsewhere stays
 * valid until its token expires (at most an hour), the standard trade-off for local verification.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as { name?: unknown; phone_number?: unknown };
  return {
    id: claims.sub,
    email: claims.email,
    name: typeof meta.name === "string" && meta.name.trim() ? meta.name.trim().slice(0, 100) : undefined,
    phone: normalizePhone(typeof meta.phone_number === "string" ? meta.phone_number : undefined) ?? undefined,
  };
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

// A user row, once it exists, never goes away while the app runs, so remember that per server instance
// and skip the database round trip on every later request (it ran on each dashboard load and each write).
const KNOWN_USER_TTL_MS = 10 * 60_000;
const knownUsers = new Map<string, number>();

/** Test hook: forget which users are known to exist. */
export function resetKnownUsers() {
  knownUsers.clear();
}

/** Drop the cached "this user exists" entry (after the account is deleted). */
export function forgetKnownUser(userId: string) {
  knownUsers.delete(userId);
}

export async function ensureUserProfile(userId: string, email: string, name?: string, phone?: string) {
  const expires = knownUsers.get(userId);
  if (expires && expires > Date.now()) return null; // already known to exist
  // Cheap indexed read on the hot path; only write for first-time users.
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  // A sign-in token stays valid for a while after deletion: it must not be able to act as the anonymised account
  if (existing && isDeletedAccount(existing.email)) throw new AccountDeletedError();
  if (existing) {
    knownUsers.set(userId, Date.now() + KNOWN_USER_TTL_MS);
    return existing;
  }
  const created = await createUserProfile(userId, email, name, phone);
  knownUsers.set(userId, Date.now() + KNOWN_USER_TTL_MS);
  return created;
}

async function createUserProfile(userId: string, email: string, name?: string, phone?: string) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      name: name ?? email.split("@")[0],
      phone: phone ?? null,
      currency: DEFAULT_CURRENCY, // DB default is USD; most users are in India
    },
  });
}

/**
 * Returns a 429 response when `who` has made too many `bucket` requests lately, otherwise null (carry on).
 * Limits are generous for real use (an offline queue replaying dozens of entries is fine) and only bite on runaway clients.
 */
export function tooManyRequests(who: string, bucket: string, max: number, windowMs = 60_000): NextResponse | null {
  const r = slidingWindow(`${bucket}:${who}`, max, windowMs);
  if (r.ok) return null;
  const res = NextResponse.json({ data: null, error: { message: "Too many requests — please wait a moment and try again" } }, { status: 429 });
  res.headers.set("Retry-After", String(r.retryAfter));
  return res;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

/** Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err((e as ZodError).issues.map((x) => x.message).join(", "), 422);
  }
  if (e instanceof SplitError) return err(e.message, 400);
  if (e instanceof AccountDeletedError) return err(e.message, 401);
  // Unique-constraint violation: the same record was created by a concurrent identical request
  if (isUniqueViolation(e)) return err("This was already saved", 409);
  console.error(e);
  return err(e instanceof Error ? e.message : "Internal server error", 500);
}

/** Expenses a user may see/modify: they are in the split OR they paid (alone or as one of several payers). */
export function visibleToUser(userId: string) {
  return { OR: [{ splits: { some: { userId } } }, { paidById: userId }, { payers: { some: { userId } } }] };
}

/**
 * Ids of every expense a user may see, read straight from the indexes (their splits, their payments, expenses they paid).
 * Why not just `visibleToUser()` for lists? `A OR B OR C` across tables cannot use an index, so the database reads EVERY
 * expense of EVERY user to answer it: measured at 150,000 expenses that took ~520 ms per dashboard load (and it grows
 * with all users' data). Three index lookups take ~0.1 ms and cost grows only with the person's own history.
 */
export async function visibleExpenseIds(userId: string): Promise<string[]> {
  // One round trip, three index lookups (expense_splits.user_id, expense_payers.user_id, expenses.paid_by_id), de-duplicated by UNION
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT expense_id AS id FROM expense_splits WHERE user_id = ${userId}
    UNION SELECT expense_id FROM expense_payers WHERE user_id = ${userId}
    UNION SELECT id FROM expenses WHERE paid_by_id = ${userId}`;
  return rows.map((r) => r.id);
}

/** Past this many expenses a single `IN (…)` list stops being sensible; fall back to the (slower, always correct) filter. */
const MAX_SCOPED_IDS = 20_000;

/** Where-clause for "expenses this user may see" in lists and totals — same meaning as visibleToUser(), but fast. */
export async function visibleScope(userId: string) {
  const ids = await visibleExpenseIds(userId);
  return ids.length <= MAX_SCOPED_IDS ? { id: { in: ids } } : visibleToUser(userId);
}

/**
 * What an expense response needs about the people and the group in it — and nothing more. The full rows carry email
 * addresses, UPI ids and (for groups) the secret invite link token, none of which any expense screen uses; sending them made
 * every expense ~2.6 KB instead of ~1 KB and handed those details to anyone who could see one expense (even someone who has
 * since left the group).
 */
export const expensePeople = { select: { id: true, name: true, avatarUrl: true } } as const;
export const expenseGroup = { select: { id: true, name: true, currency: true, category: true } } as const;
export const expenseResponseInclude = {
  paidBy: expensePeople,
  splits: { include: { user: expensePeople } },
  payers: { include: { user: expensePeople } },
  group: expenseGroup,
} as const;

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
  const visibleIds = await visibleExpenseIds(userId);
  const [friends, coMembers, expenseMates] = await Promise.all([
    prisma.friendship.findMany({ where: { userId, status: "ACCEPTED" }, select: { friendId: true } }),
    prisma.groupMember.findMany({
      where: { group: { members: { some: { userId } } } },
      select: { userId: true },
    }),
    prisma.expenseSplit.findMany({
      where: { expenseId: { in: visibleIds.slice(0, 5_000) } }, // (their most relevant 5,000 expenses is plenty to know who they deal with)
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
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Test hook: forget all rate-limit counters. */
export function resetRateLimits() {
  resetWindows();
}

/**
 * True when `key` has made more than `limit` requests in the last `windowMs` (the request should be refused).
 * Key it by the signed-in user where there is one: an IP address can be shared by a whole office, college or mobile
 * carrier, and one busy neighbour must not block everyone else. Bounded in memory (see lib/rate-limit.ts).
 */
export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  return !slidingWindow(key, limit, windowMs).ok;
}

export { safeRedirectPath } from "@/lib/safe-redirect";
