import { CURRENCY_CODES } from "@/lib/currencies";
import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.enum(["HOME", "TRIP", "COUPLE", "FRIENDS", "WORK", "OTHER"]),
  currency: z.enum(CURRENCY_CODES),
  memberEmails: z.array(z.string().trim().email()).optional(),
});

export const updateGroupSchema = createGroupSchema.partial().extend({
  id: z.string().uuid(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
