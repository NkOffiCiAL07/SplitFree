import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ZodError } from "zod";

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export async function ensureUserProfile(userId: string, email: string, name?: string) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      name: name ?? email.split("@")[0],
    },
  });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err((e as ZodError).issues.map((x) => x.message).join(", "), 422);
  }
  console.error(e);
  return err(e instanceof Error ? e.message : "Internal server error", 500);
}

// Simple in-memory rate limiter per IP (resets on cold start)
const ipMap = new Map<string, { count: number; reset: number }>();

export function rateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.reset) {
    ipMap.set(ip, { count: 1, reset: now + windowMs });
    return false; // not limited
  }
  if (entry.count >= limit) return true; // limited
  entry.count++;
  return false;
}
