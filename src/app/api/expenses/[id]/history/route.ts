import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, visibleToUser } from "@/lib/api-helpers";
import { loadPeople } from "@/lib/ledger-db";
import type { Changes } from "@/lib/revisions";

/** User ids mentioned inside a revision's changes, so the client can show names instead of ids. */
function idsIn(changes: Changes): string[] {
  const ids: string[] = [];
  for (const [field, c] of Object.entries(changes)) {
    for (const v of [c.from, c.to]) {
      if (field === "paidBy" && typeof v === "string") ids.push(v);
      else if (field === "participants" && Array.isArray(v)) ids.push(...(v as string[]));
      else if (field === "payers" && Array.isArray(v)) ids.push(...(v as { userId: string }[]).map((p) => p.userId));
    }
  }
  return ids;
}

// GET — edit history of one expense (newest first)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;

    const expense = await prisma.expense.findFirst({ where: { id, ...visibleToUser(user!.id) }, select: { id: true, currency: true } });
    if (!expense) return err("Expense not found", 404);

    const revisions = await prisma.expenseRevision.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, userId: true, changes: true, createdAt: true },
    });

    const people = await loadPeople(revisions.flatMap((r) => [r.userId, ...idsIn(r.changes as unknown as Changes)]));
    return ok({
      currency: expense.currency,
      people: Object.fromEntries([...people.entries()].map(([k, v]) => [k, v.name])),
      revisions: revisions.map((r) => ({ id: r.id, editorId: r.userId, changes: r.changes, createdAt: r.createdAt })),
    });
  } catch (e) {
    return handleError(e);
  }
}
