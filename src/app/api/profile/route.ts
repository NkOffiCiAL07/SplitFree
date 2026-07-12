import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  currency: z.enum(["USD","EUR","GBP","INR","CAD","AUD","JPY"]).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const profile = await prisma.user.findUnique({ where: { id: user!.id } });
    if (!profile) return err("Profile not found", 404);
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const profile = await prisma.user.update({
      where: { id: user!.id },
      data,
    });
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}
