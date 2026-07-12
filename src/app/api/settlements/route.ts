import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError } from "@/lib/api-helpers";
import { z } from "zod";
import { toCents } from "@/lib/utils";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

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

    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [{ fromUserId: user!.id }, { toUserId: user!.id }],
        ...(groupId ? { groupId } : {}),
      },
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: "desc" },
    });

    if (simplified && groupId) {
      // Calculate raw debts from expenses and simplify them
      const expenses = await prisma.expense.findMany({
        where: { groupId },
        include: { splits: true },
      });

      const rawDebts = expenses.flatMap((exp) =>
        exp.splits
          .filter((s) => !s.isPaid && s.userId !== exp.paidById)
          .map((s) => ({ fromUserId: s.userId, toUserId: exp.paidById, amount: s.amount }))
      );

      // Subtract existing settlements
      const settledMap = new Map<string, number>();
      settlements.forEach((s) => {
        const key = `${s.fromUserId}→${s.toUserId}`;
        settledMap.set(key, (settledMap.get(key) ?? 0) + s.amount);
      });

      const adjustedDebts = rawDebts.map((d) => {
        const key = `${d.fromUserId}→${d.toUserId}`;
        const settled = settledMap.get(key) ?? 0;
        return { ...d, amount: Math.max(0, d.amount - settled) };
      }).filter((d) => d.amount > 0);

      const simplified = simplifyDebts(adjustedDebts);
      return ok({ settlements, simplified });
    }

    return ok(settlements);
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

    const settlement = await prisma.settlement.create({
      data: {
        fromUserId: user!.id,
        toUserId: data.toUserId,
        amount: toCents(data.amount),
        currency: data.currency,
        groupId: data.groupId ?? null,
        note: data.note ?? null,
      },
      include: { fromUser: true, toUser: true },
    });

    await prisma.notification.create({
      data: {
        userId: data.toUserId,
        type: "SETTLEMENT_ADDED",
        title: "Payment received",
        body: `${settlement.fromUser.name} paid you $${data.amount.toFixed(2)}`,
        data: { settlementId: settlement.id },
      },
    });

    await prisma.activity.create({
      data: {
        type: "SETTLEMENT_CREATED",
        userId: user!.id,
        settlementId: settlement.id,
        groupId: data.groupId ?? null,
        metadata: { amount: toCents(data.amount), toUserId: data.toUserId },
      },
    });

    return ok(settlement, 201);
  } catch (e) {
    return handleError(e);
  }
}
