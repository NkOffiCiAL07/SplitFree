import { CURRENCY_CODES } from "@/lib/currencies";
import { isValidUpiId } from "@/lib/settle-tools";
import { normalizePhone } from "@/lib/phone";
import { phoneSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, ensureUserProfile, ok, err, handleError, tooManyRequests } from "@/lib/api-helpers";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  emailNotifications: z.boolean().optional(),
  // Mobile number: can be changed but never removed (it is required); stored in international format
  phone: phoneSchema.optional(),
  // "" or null clears it; otherwise it must look like name@bank
  upiId: z.union([z.literal(""), z.string().trim().refine(isValidUpiId, "Enter a valid UPI ID like name@bank")]).nullable().optional(),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    // A brand-new account has no row until its first request: make it now, so the app can ask for what's missing
    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);
    const profile = await prisma.user.findUnique({ where: { id: user!.id }, omit: { phone: false } }); // your own number is yours to see
    if (!profile) return err("Profile not found", 404);
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  { const limited = tooManyRequests(user!.id, "profile-write", 30); if (limited) return limited; }

  try {
    const body = await request.json();
    const data = updateProfileSchema.parse(body);
    await ensureUserProfile(user!.id, user!.email!, user!.name, user!.phone);

    const profile = await prisma.user.update({
      where: { id: user!.id },
      omit: { phone: false },
      data: {
        ...data,
        ...(data.upiId !== undefined ? { upiId: data.upiId ? data.upiId.trim() : null } : {}),
        ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) } : {}),
      },
    });
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}
