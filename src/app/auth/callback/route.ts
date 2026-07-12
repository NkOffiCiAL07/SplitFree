import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sync user profile to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { prisma } = await import("@/lib/prisma");
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            email: user.email!,
            name: user.user_metadata?.name ?? user.email!.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url ?? null,
          },
          create: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name ?? user.email!.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url ?? null,
          },
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
