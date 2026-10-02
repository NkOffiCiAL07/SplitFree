import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().positive("Amount must be positive").max(1_000_000),
  currency: z.enum(CURRENCY_CODES).default(DEFAULT_CURRENCY),
  category: z.enum([
    "FOOD", "TRANSPORT", "ACCOMMODATION", "ENTERTAINMENT",
    "UTILITIES", "SHOPPING", "HEALTH", "TRAVEL", "EDUCATION", "OTHER",
  ]).default("OTHER"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]).default("EQUAL"),
  paidById: z.string().uuid(),
  groupId: z.string().uuid().optional().nullable(),
  date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional().nullable(),
  participants: z.array(z.string().uuid()).min(1, "At least one participant required"),
  splits: z.record(z.string(), z.number()).optional(),
});

// NOTE: zod keeps `.default()` values on `.partial()` fields, which would silently reset
// currency/category/splitType/isRecurring on every edit. Redeclare them without defaults so an
// omitted field means "unchanged".
export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
  currency: createExpenseSchema.shape.currency.removeDefault().optional(),
  category: createExpenseSchema.shape.category.removeDefault().optional(),
  splitType: createExpenseSchema.shape.splitType.removeDefault().optional(),
  isRecurring: createExpenseSchema.shape.isRecurring.removeDefault().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
