import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError, rateLimit, clientIp, forgetKnownUser } from "@/lib/api-helpers";
import { loadUserLedger, loadPeople } from "@/lib/ledger-db";
import { balanceBlockers, deletedEmail, DELETED_NAME } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * DELETE /api/account — body: { confirmEmail }.
 *  1. refused (409) while you still owe or are owed money (we list who) — nobody is left with an unrecoverable debt;
 *  2. otherwise your personal data is removed and the account is anonymised, keeping shared expenses intact;
 *  3. finally the sign-in itself is deleted. Safe to call again if step 3 failed.
 */
export async function DELETE(req: NextRequest) {
  if (rateLimit(clientIp(req), 5)) return err("Too many requests", 429);
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const userId = user!.id;

    const body = await req.json().catch(() => ({}));
    if (typeof body?.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== (user!.email ?? "").toLowerCase()) {
      return err("Type your email address to confirm", 400);
    }

    const { edges } = await loadUserLedger(userId);
    const blockers = balanceBlockers(edges, userId);
    if (blockers.length > 0) {
      const people = await loadPeople(blockers.map((b) => b.userId));
      return NextResponse.json(
        {
          data: null,
          error: { message: "Settle up before deleting your account — you still have balances with other people." },
          blockers: blockers.map((b) => ({ ...b, name: people.get(b.userId)?.name ?? "Someone" })),
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Groups: keep every group alive for the others (admin handed over; a group nobody is left in is archived)
      const memberships = await tx.groupMember.findMany({ where: { userId }, select: { groupId: true, role: true } });
      for (const m of memberships) {
        const others = await tx.groupMember.findMany({
          where: { groupId: m.groupId, userId: { not: userId } },
          orderBy: { joinedAt: "asc" },
          select: { id: true, role: true },
        });
        if (others.length === 0) {
          await tx.group.update({ where: { id: m.groupId }, data: { archivedAt: new Date() } });
        } else if (m.role === "ADMIN" && !others.some((o) => o.role === "ADMIN")) {
          await tx.groupMember.update({ where: { id: others[0].id }, data: { role: "ADMIN" } });
        }
      }

      // Personal data goes. Shared money records (expenses, splits, payments, edit history) stay for the others.
      await tx.groupMember.deleteMany({ where: { userId } });
      await tx.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.expenseComment.deleteMany({ where: { userId } });
      await tx.activity.deleteMany({ where: { userId } });
      await tx.groupInvite.deleteMany({ where: { OR: [{ invitedBy: userId }, { email: user!.email! }] } });

      await tx.user.update({
        where: { id: userId },
        data: { name: DELETED_NAME, email: deletedEmail(userId), avatarUrl: null, upiId: null, phone: null, emailNotifications: false },
      });
    });
    forgetKnownUser(userId);

    // Last: the sign-in. If this fails the data is already gone from view; calling DELETE again finishes the job.
    try {
      const admin = await createAdminClient();
      const { error: authError } = await admin.auth.admin.deleteUser(userId);
      if (authError && !/not found/i.test(authError.message)) throw authError;
    } catch (e) {
      console.error("[account] anonymised, but deleting the sign-in failed:", e);
      return err("Your data was removed, but we couldn't finish closing the account. Please try again.", 500);
    }

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
