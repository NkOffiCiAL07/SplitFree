import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError, visibleToUser } from "@/lib/api-helpers";
import { format } from "date-fns";
import { fromCents } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const groupId = new URL(req.url).searchParams.get("groupId");

    const expenses = await prisma.expense.findMany({
      where: {
        ...visibleToUser(user!.id),
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
      ["Date", "Description", "Category", "Currency", "Total Amount", "Paid By", "Your Share", "Group", "Split Type"],
      ...expenses.map((exp) => {
        const myShare = exp.splits.find((s) => s.userId === user!.id);
        return [
          format(exp.date, "yyyy-MM-dd"),
          exp.description,
          exp.category,
          exp.currency,
          fromCents(exp.amount).toFixed(2),
          exp.paidBy.name,
          fromCents(myShare?.amount ?? 0).toFixed(2),
          exp.group?.name ?? "No group",
          exp.splitType,
        ];
      }),
    ];

    // Neutralise spreadsheet formula injection (cells starting with = + - @ or control chars)
    const safe = (cell: unknown) => {
      const v = String(cell);
      return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    };
    const csv = rows
      .map((row) => row.map((cell) => `"${safe(cell).replace(/"/g, '""')}"`).join(","))
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
