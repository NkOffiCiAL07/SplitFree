import { createNotifications } from "@/lib/notify";
import { CURRENCY_CODES, DEFAULT_CURRENCY, isLegalAmount } from "@/lib/currencies";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, isUniqueViolation, isGroupMember, getKnownUserIds, parseLimit } from "@/lib/api-helpers";
import { z } from "zod";
import { toCents, formatCurrency } from "@/lib/utils";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";
import { loadGroupLedger } from "@/lib/ledger-db";

const userSelect = { select: { id: true, name: true, avatarUrl: true } } as const;

const createSettlementSchema = z.object({
  clientId: z.string().uuid().optional(), // lets a retried (offline-queued) request be recognised
  toUserId: z.string().uuid(),
  amount: z.number().positive(),
  groupId: z.string().uuid().optional().nullable(),
  note: z.string().max(200).optional(),
  currency: z.enum(CURRENCY_CODES).default(DEFAULT_CURRENCY),
});

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const simplified = searchParams.get("simplified") === "true";
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = searchParams.get("cursor");

    // Group-scoped data is only for members
    if (groupId && !(await isGroupMember(groupId, user!.id))) {
      return err("Not a member of this group", 403);
    }

    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [{ fromUserId: user!.id }, { toUserId: user!.id }],
        ...(groupId ? { groupId } : {}),
      },
      include: { fromUser: userSelect, toUser: userSelect },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (simplified && groupId) {
      // Every expense AND every settlement in the group (not just mine, not just a page), netted per currency.
      // Multi-payer expenses and third-party payments are handled by the shared ledger.
      const { edges } = await loadGroupLedger(groupId);
      const byCurrency = new Map<string, { fromUserId: string; toUserId: string; amount: number }[]>();
      for (const e of edges) {
        const list = byCurrency.get(e.currency) ?? [];
        list.push({ fromUserId: e.fromUserId, toUserId: e.toUserId, amount: e.amount });
        byCurrency.set(e.currency, list);
      }
      const simplifiedDebts = [...byCurrency.entries()].flatMap(([currency, debts]) =>
        simplifyDebts(debts).map((d) => ({ ...d, currency }))
      );
      return ok({ settlements, simplified: simplifiedDebts });
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

    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);

    const body = await req.json();
    const data = createSettlementSchema.parse(body);

    if (data.toUserId === user!.id) return err("Cannot settle with yourself", 400);
    if (!isLegalAmount(toCents(data.amount), data.currency)) return err("This currency has no fractional amounts — use a whole number", 400);

    if (data.clientId) {
      const existing = await prisma.settlement.findUnique({
        where: { id: data.clientId },
        include: { fromUser: userSelect, toUser: userSelect },
      });
      if (existing) return existing.fromUserId === user!.id ? ok(existing, 200) : err("Conflict", 409);
    }

    if (data.groupId) {
      const [payerIn, payeeIn] = await Promise.all([
        isGroupMember(data.groupId, user!.id),
        isGroupMember(data.groupId, data.toUserId),
      ]);
      if (!payerIn || !payeeIn) return err("Both people must be members of the group", 403);
    } else if (!(await getKnownUserIds(user!.id)).has(data.toUserId)) {
      return err("Unknown recipient", 403);
    }

    // Wrap settlement + all notifications in a transaction
    let settlement;
    try {
    settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          ...(data.clientId ? { id: data.clientId } : {}),
          fromUserId: user!.id,
          toUserId: data.toUserId,
          amount: toCents(data.amount),
          currency: data.currency,
          groupId: data.groupId ?? null,
          note: data.note ?? null,
        },
        include: { fromUser: userSelect, toUser: userSelect },
      });

      await createNotifications([{
          userId: data.toUserId,
          type: "SETTLEMENT_ADDED",
          title: "Payment received",
          body: `${s.fromUser.name} paid you ${formatCurrency(toCents(data.amount), data.currency)}`,
          data: { settlementId: s.id, groupId: data.groupId },
        }], tx);

      if (data.groupId) {
        const groupMembers = await tx.groupMember.findMany({
          where: { groupId: data.groupId },
          select: { userId: true },
        });
        const otherIds = groupMembers
          .map((m) => m.userId)
          .filter((id) => id !== user!.id && id !== data.toUserId);

        if (otherIds.length > 0) {
          await createNotifications(otherIds.map((uid) => ({
              userId: uid,
              type: "SETTLEMENT_ADDED" as const,
              title: "Payment recorded",
              body: `${s.fromUser.name} paid ${s.toUser.name} ${formatCurrency(toCents(data.amount), data.currency)}`,
              data: { settlementId: s.id, groupId: data.groupId },
            })), tx);
        }
      }

      await tx.activity.create({
        data: {
          type: "SETTLEMENT_CREATED",
          userId: user!.id,
          settlementId: s.id,
          groupId: data.groupId ?? null,
          metadata: { amount: toCents(data.amount), toUserId: data.toUserId, currency: data.currency },
        },
      });

      return s;
    });
    } catch (e) {
      // Two identical requests raced: the loser returns the winner's row instead of failing
      if (data.clientId && isUniqueViolation(e)) {
        const winner = await prisma.settlement.findUnique({ where: { id: data.clientId }, include: { fromUser: userSelect, toUser: userSelect } });
        if (winner && winner.fromUserId === user!.id) return ok(winner, 200);
      }
      throw e;
    }

    return ok(settlement, 201);
  } catch (e) {
    return handleError(e);
  }
}
