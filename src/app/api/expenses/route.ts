import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, rateLimit, visibleToUser, getKnownUserIds, parseLimit, clientIp } from "@/lib/api-helpers";
import { createExpenseSchema } from "@/lib/validations/expense";
import { calculateSplits } from "@/lib/algorithms/debt-simplification";
import { toCents, formatCurrency } from "@/lib/utils";
import { validatePayers } from "@/lib/ledger";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = searchParams.get("cursor");

    const expenses = await prisma.expense.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        ...visibleToUser(user!.id),
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
        payers: { include: { user: true } },
        group: true,
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return ok(expenses);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimit(ip, 30)) return err("Too many requests", 429);

  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    await ensureUserProfile(user!.id, user!.email!);

    const body = await req.json();
    const data = createExpenseSchema.parse(body);

    if (data.groupId) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: data.groupId, userId: user!.id } },
      });
      if (!member) return err("Not a member of this group", 403);
    }

    // Multiple payers: amounts (major units) → cents, must add up to the total
    const totalCents = toCents(data.amount);
    const payersCents = data.payers?.map((p) => ({ userId: p.userId, amount: toCents(p.amount) })) ?? [];
    if (payersCents.length > 0) {
      const problem = validatePayers(payersCents, totalCents);
      if (problem) return err(problem, 400);
    }
    // With several payers the "primary" payer (kept in paidById for compatibility) is whoever paid most
    const primaryPayer = payersCents.length > 0
      ? [...payersCents].sort((a, b) => b.amount - a.amount)[0].userId
      : data.paidById;

    // Everyone involved must belong to the group (or be someone the caller already knows)
    const involved = [...new Set([primaryPayer, ...payersCents.map((p) => p.userId), ...data.participants])];
    let allowed: Set<string>;
    if (data.groupId) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: data.groupId },
        select: { userId: true },
      });
      allowed = new Set(members.map((m) => m.userId));
    } else {
      allowed = await getKnownUserIds(user!.id);
    }
    if (involved.some((id) => !allowed.has(id))) {
      return err(data.groupId ? "All participants must be members of the group" : "Unknown participant", 403);
    }

    const splitAmounts = calculateSplits(
      totalCents,
      data.participants,
      data.splitType,
      data.splits
    );

    const expense = await prisma.expense.create({
      data: {
        description: data.description,
        amount: totalCents,
        currency: data.currency,
        category: data.category,
        splitType: data.splitType,
        paidById: primaryPayer,
        groupId: data.groupId ?? null,
        date: data.date,
        notes: data.notes ?? null,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval ?? null,
        ...(payersCents.length > 0 ? { payers: { create: payersCents } } : {}),
        splits: {
          create: data.participants.map((uid) => ({
            userId: uid,
            amount: splitAmounts[uid] ?? 0,
            percentage: data.splitType === "PERCENTAGE" ? (data.splits?.[uid] ?? 0) : null,
            shares: data.splitType === "SHARES" ? (data.splits?.[uid] ?? 0) : null,
          })),
        },
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
        payers: { include: { user: true } },
        group: true,
      },
    });

    // Notify every group member except the payer
    const payerIds = new Set([primaryPayer, ...payersCents.map((p) => p.userId)]);
    let notifyIds: string[] = data.participants.filter((id) => !payerIds.has(id));

    if (data.groupId) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: data.groupId },
        select: { userId: true },
      });
      const memberIds = groupMembers.map((m) => m.userId).filter((id) => !payerIds.has(id));
      // Union of split participants + other group members
      notifyIds = [...new Set([...notifyIds, ...memberIds])];
    }

    if (notifyIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyIds.map((uid) => {
          const myShare = splitAmounts[uid];
          return {
            userId: uid,
            type: "EXPENSE_ADDED" as const,
            title: `${expense.paidBy.name} added an expense`,
            body: `${data.description}${myShare != null ? ` — your share: ${formatCurrency(myShare, data.currency)}` : ""}`,
            data: { expenseId: expense.id, groupId: data.groupId },
          };
        }),
        skipDuplicates: true,
      });
    }

    await prisma.activity.create({
      data: {
        type: "EXPENSE_CREATED",
        userId: user!.id,
        groupId: data.groupId ?? null,
        expenseId: expense.id,
        metadata: { description: data.description, amount: totalCents },
      },
    });

    return ok(expense, 201);
  } catch (e) {
    return handleError(e);
  }
}
