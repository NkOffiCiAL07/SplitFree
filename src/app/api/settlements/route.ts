import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError } from "@/lib/api-helpers";
import { z } from "zod";
import { toCents, formatCurrency } from "@/lib/utils";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

const userSelect = { select: { id: true, name: true, avatarUrl: true } } as const;

const createSettlementSchema = z.object({
  toUserId: z.string().uuid(),
  amount: z.number().positive(),
  groupId: z.string().uuid().optional().nullable(),
  note: z.string().max(200).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"]).default("USD"),
});

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const simplified = searchParams.get("simplified") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const cursor = searchParams.get("cursor");

    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [{ fromUserId: user!.id }, { toUserId: user!.id }],
        ...(groupId ? { groupId } : {}),
      },
      include: { fromUser: userSelect, toUser: userSelect },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (simplified && groupId) {
      const expenses = await prisma.expense.findMany({
        where: { groupId },
        select: { paidById: true, splits: { select: { userId: true, amount: true, isPaid: true } } },
      });

      const expenseDebts = expenses.flatMap((exp) =>
        exp.splits
          .filter((s) => !s.isPaid && s.userId !== exp.paidById)
          .map((s) => ({ fromUserId: s.userId, toUserId: exp.paidById, amount: s.amount }))
      );

      // Represent each settlement as a counter-debt so simplifyDebts can net everything correctly.
      // This handles overpayments and cross-direction payments that settledMap would lose.
      const settlementCounterDebts = settlements.map((s) => ({
        fromUserId: s.toUserId,
        toUserId: s.fromUserId,
        amount: s.amount,
      }));

      return ok({ settlements, simplified: simplifyDebts([...expenseDebts, ...settlementCounterDebts]) });
    }

    const res = ok(settlements);
    res.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();
    const data = createSettlementSchema.parse(body);

    if (data.toUserId === user!.id) return err("Cannot settle with yourself", 400);

    // Wrap settlement + all notifications in a transaction
    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          fromUserId: user!.id,
          toUserId: data.toUserId,
          amount: toCents(data.amount),
          currency: data.currency,
          groupId: data.groupId ?? null,
          note: data.note ?? null,
        },
        include: { fromUser: userSelect, toUser: userSelect },
      });

      await tx.notification.create({
        data: {
          userId: data.toUserId,
          type: "SETTLEMENT_ADDED",
          title: "Payment received",
          body: `${s.fromUser.name} paid you ${formatCurrency(toCents(data.amount), data.currency)}`,
          data: { settlementId: s.id, groupId: data.groupId },
        },
      });

      if (data.groupId) {
        const groupMembers = await tx.groupMember.findMany({
          where: { groupId: data.groupId },
          select: { userId: true },
        });
        const otherIds = groupMembers
          .map((m) => m.userId)
          .filter((id) => id !== user!.id && id !== data.toUserId);

        if (otherIds.length > 0) {
          await tx.notification.createMany({
            data: otherIds.map((uid) => ({
              userId: uid,
              type: "SETTLEMENT_ADDED" as const,
              title: "Payment recorded",
              body: `${s.fromUser.name} paid ${s.toUser.name} ${formatCurrency(toCents(data.amount), data.currency)}`,
              data: { settlementId: s.id, groupId: data.groupId },
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.activity.create({
        data: {
          type: "SETTLEMENT_CREATED",
          userId: user!.id,
          settlementId: s.id,
          groupId: data.groupId ?? null,
          metadata: { amount: toCents(data.amount), toUserId: data.toUserId },
        },
      });

      return s;
    });

    return ok(settlement, 201);
  } catch (e) {
    return handleError(e);
  }
}
