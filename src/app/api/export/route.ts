import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/api-helpers";
import { format } from "date-fns";
import { fromCents } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const groupId = new URL(req.url).searchParams.get("groupId");

    const expenses = await prisma.expense.findMany({
      where: {
        splits: { some: { userId: user!.id } },
        ...(groupId ? { groupId } : {}),
      },
      include: {
        paidBy: true,
        splits: { include: { user: true } },
        group: true,
      },
      orderBy: { date: "desc" },
    });

    const rows = [
      ["Date", "Description", "Category", "Total Amount", "Paid By", "Your Share", "Group", "Split Type"],
      ...expenses.map((exp) => {
        const myShare = exp.splits.find((s) => s.userId === user!.id);
        return [
          format(exp.date, "yyyy-MM-dd"),
          exp.description,
          exp.category,
          fromCents(exp.amount).toFixed(2),
          exp.paidBy.name,
          fromCents(myShare?.amount ?? 0).toFixed(2),
          exp.group?.name ?? "No group",
          exp.splitType,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="splitfree-export-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
