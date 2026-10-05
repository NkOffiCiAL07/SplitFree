import { NextRequest } from "next/server";
import { z } from "zod";
import type { Currency, ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit, getKnownUserIds, isGroupArchived, ARCHIVED_MESSAGE } from "@/lib/api-helpers";
import { CURRENCY_CODES } from "@/lib/currencies";
import { rowToRecord, type ImportedExpense, type ImportedSettlement } from "@/lib/splitwise-import";

const MAX_ROWS = 1000;

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  category: z.string().max(100),
  cost: z.number().int().positive().max(100_000_000_00),
  currency: z.enum(CURRENCY_CODES),
  nets: z.record(z.string().max(100), z.number().int()),
  isPayment: z.boolean(),
});

const importSchema = z.object({
  groupId: z.string().uuid().nullable(),
  /** CSV person name → app user id */
  mapping: z.record(z.string().max(100), z.string().uuid()),
  rows: z.array(rowSchema).min(1).max(MAX_ROWS),
});

const noon = (date: string) => new Date(`${date}T12:00:00.000Z`); // avoids timezone day-shifts
const fingerprint = (e: { description: string; amount: number; date: Date | string; paidById: string }) =>
  `${e.description}|${e.amount}|${new Date(e.date).toISOString().slice(0, 10)}|${e.paidById}`;

// POST — import a parsed Splitwise export into a group (or between friends)
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const me = user!.id;
    if (rateLimit(`import:${me}`, 5, 60 * 60_000)) return err("Too many imports, try again later", 429);

    const { groupId, mapping, rows } = importSchema.parse(await req.json());
    await ensureUserProfile(me, user!.email!, user!.name, user!.phone);

    const mappedIds = new Set(Object.values(mapping));
    if (!mappedIds.has(me)) return err("Map yourself to one of the people in the file", 400);

    // Everyone must be allowed to share expenses with the caller
    if (groupId) {
      const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
      const memberIds = new Set(members.map((m) => m.userId));
      if (!memberIds.has(me)) return err("Not a member of this group", 403);
      if (await isGroupArchived(groupId)) return err(ARCHIVED_MESSAGE, 409);
      if ([...mappedIds].some((id) => !memberIds.has(id))) return err("Everyone you map to must be a member of the group", 403);
    } else {
      const known = await getKnownUserIds(me);
      if ([...mappedIds].some((id) => !known.has(id))) return err("You can only import expenses with people you know", 403);
    }

    const expenses: ImportedExpense[] = [];
    const settlements: ImportedSettlement[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      const result = rowToRecord(row, mapping);
      if (result.kind === "expense") expenses.push(result.expense);
      else if (result.kind === "settlement") settlements.push(result.settlement);
      else skipped.push(result.reason);
    }

    // Idempotency: skip anything already there (same description, amount, date and payer in this group)
    let duplicates = 0;
    let fresh = expenses;
    if (expenses.length > 0) {
      const dates = expenses.map((e) => e.date).sort();
      const existing = await prisma.expense.findMany({
        where: { groupId, date: { gte: noon(dates[0]), lte: new Date(`${dates[dates.length - 1]}T23:59:59.999Z`) } },
        select: { description: true, amount: true, date: true, paidById: true },
      });
      const seen = new Set(existing.map(fingerprint));
      fresh = expenses.filter((e) => {
        const key = fingerprint({ ...e, date: e.date });
        if (seen.has(key)) { duplicates++; return false; }
        seen.add(key);
        return true;
      });
    }

    for (let i = 0; i < fresh.length; i += 50) {
      await prisma.$transaction(
        fresh.slice(i, i + 50).map((e) =>
          prisma.expense.create({
            data: {
              groupId,
              description: e.description,
              amount: e.amount,
              currency: e.currency as Currency,
              category: e.category as ExpenseCategory,
              splitType: "EXACT",
              paidById: e.paidById,
              date: noon(e.date),
              ...(e.payers.length > 0 ? { payers: { create: e.payers } } : {}),
              splits: { create: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })) },
            },
          })
        )
      );
    }
    if (settlements.length > 0) {
      await prisma.settlement.createMany({
        data: settlements.map((s) => ({
          groupId, fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount, currency: s.currency as Currency,
          note: s.note, createdAt: noon(s.date),
        })),
      });
    }

    return ok({ imported: fresh.length, settlements: settlements.length, duplicates, skipped: skipped.slice(0, 20), skippedCount: skipped.length }, 201);
  } catch (e) {
    return handleError(e);
  }
}
