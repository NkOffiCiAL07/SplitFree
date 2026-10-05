import { z } from "zod";
import { isValidPhone } from "@/lib/phone";

/** One password policy for signing up AND resetting, so a reset can't weaken the account. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

/** A mobile number is required to create an account (Indian numbers can be typed plainly; others need their + code). */
export const phoneSchema = z.string().trim().min(1, "Enter your mobile number").refine(isValidPhone, "Enter a valid mobile number, like 98765 43210");

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  phone: phoneSchema,
  email: z.string().trim().email("Enter a valid email"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updatePasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });
