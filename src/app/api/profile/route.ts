import { CURRENCY_CODES } from "@/lib/currencies";
import { isValidUpiId } from "@/lib/settle-tools";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err, handleError } from "@/lib/api-helpers";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  emailNotifications: z.boolean().optional(),
  // "" or null clears it; otherwise it must look like name@bank
  upiId: z.union([z.literal(""), z.string().trim().refine(isValidUpiId, "Enter a valid UPI ID like name@bank")]).nullable().optional(),
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
      data: { ...data, ...(data.upiId !== undefined ? { upiId: data.upiId ? data.upiId.trim() : null } : {}) },
    });
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}
