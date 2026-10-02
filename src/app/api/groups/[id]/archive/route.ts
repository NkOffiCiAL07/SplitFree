import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";

const schema = z.object({ archived: z.boolean() });

// POST — archive or restore a group (admins only). Archived groups are read-only history:
// they leave the active list, can't get new expenses or members, but balances can still be settled.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    const { id } = await params;
    const { archived } = schema.parse(await req.json());

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user!.id } },
      select: { role: true },
    });
    if (!member) return err("Not a member of this group", 403);
    if (member.role !== "ADMIN") return err("Only admins can archive or restore a group", 403);

    const group = await prisma.group.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
    if (!group) return err("Group not found", 404);
    if (archived === !!group.archivedAt) return ok({ id, archivedAt: group.archivedAt }); // already in that state

    const updated = await prisma.group.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
      select: { id: true, archivedAt: true },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
