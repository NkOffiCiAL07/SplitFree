import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, isGroupMember, getKnownUserIds, parseLimit } from "@/lib/api-helpers";
import { z } from "zod";
import { toCents, formatCurrency } from "@/lib/utils";
import { simplifyDebts } from "@/lib/algorithms/debt-simplification";

const userSelect = { select: { id: true, name: true, avatarUrl: true } } as const;

const createSettlementSchema = z.object({
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
      const expenses = await prisma.expense.findMany({
        where: { groupId },
        select: { paidById: true, currency: true, splits: { select: { userId: true, amount: true, isPaid: true } } },
      });

      // Netting needs EVERY settlement in the group (not just mine, not just the latest page),
      // otherwise payments between other members are ignored.
      const allGroupSettlements = await prisma.settlement.findMany({
        where: { groupId },
        select: { fromUserId: true, toUserId: true, amount: true, currency: true },
      });

      // Each currency is netted on its own — rupees never cancel dollars.
      const debtsByCurrency = new Map<string, { fromUserId: string; toUserId: string; amount: number }[]>();
      const push = (currency: string, debt: { fromUserId: string; toUserId: string; amount: number }) => {
        const list = debtsByCurrency.get(currency) ?? [];
        list.push(debt);
        debtsByCurrency.set(currency, list);
      };
      for (const exp of expenses) {
        for (const sp of exp.splits) {
          if (!sp.isPaid && sp.userId !== exp.paidById) {
            push(exp.currency, { fromUserId: sp.userId, toUserId: exp.paidById, amount: sp.amount });
          }
        }
      }
      // A settlement is a counter-debt, so overpayments and cross-direction payments net correctly.
      for (const st of allGroupSettlements) {
        push(st.currency, { fromUserId: st.toUserId, toUserId: st.fromUserId, amount: st.amount });
      }

      const simplifiedDebts = [...debtsByCurrency.entries()].flatMap(([currency, debts]) =>
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

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();
    const data = createSettlementSchema.parse(body);

    if (data.toUserId === user!.id) return err("Cannot settle with yourself", 400);

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
