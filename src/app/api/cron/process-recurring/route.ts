import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, addWeeks, addMonths, addYears, startOfDay, endOfDay } from "date-fns";

function nextOccurrence(date: Date, interval: string): Date {
  switch (interval) {
    case "DAILY":   return addDays(date, 1);
    case "WEEKLY":  return addWeeks(date, 1);
    case "MONTHLY": return addMonths(date, 1);
    case "YEARLY":  return addYears(date, 1);
    default: return addMonths(date, 1);
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const created: string[] = [];
  const skipped: string[] = [];

  try {
    // Find all root recurring expenses whose next due date has arrived
    const recurringExpenses = await prisma.expense.findMany({
      where: { isRecurring: true, recurringParentId: null },
      include: { splits: true },
    });

    for (const expense of recurringExpenses) {
      if (!expense.recurringInterval) continue;

      // Compute the latest occurrence date (from last processed or original date)
      const baseDate = expense.lastRecurredAt ?? expense.date;
      const nextDue = nextOccurrence(baseDate, expense.recurringInterval);

      // Only create if next due date is today or in the past
      if (nextDue > today) {
        skipped.push(expense.id);
        continue;
      }

      // Check if already created for this period to prevent double-processing
      const alreadyExists = await prisma.expense.findFirst({
        where: {
          recurringParentId: expense.id,
          date: { gte: startOfDay(nextDue), lte: endOfDay(nextDue) },
        },
      });

      if (alreadyExists) {
        skipped.push(expense.id);
        continue;
      }

      // Create the next occurrence
      await prisma.$transaction(async (tx) => {
        const newExpense = await tx.expense.create({
          data: {
            groupId: expense.groupId,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            category: expense.category,
            splitType: expense.splitType,
            paidById: expense.paidById,
            date: nextDue,
            isRecurring: false,
            notes: expense.notes,
            recurringParentId: expense.id,
            splits: {
              create: expense.splits.map((s) => ({
                userId: s.userId,
                amount: s.amount,
                percentage: s.percentage,
                shares: s.shares,
              })),
            },
          },
        });

        // Update parent's lastRecurredAt
        await tx.expense.update({
          where: { id: expense.id },
          data: { lastRecurredAt: nextDue },
        });

        created.push(newExpense.id);
      });
    }

    return NextResponse.json({ ok: true, created: created.length, skipped: skipped.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
