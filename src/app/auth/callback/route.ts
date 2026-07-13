import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            const { prisma } = await import("@/lib/prisma");

            // Upsert the user profile
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

            // Accept any pending group invites for this email
            const pendingInvites = await prisma.groupInvite.findMany({
              where: { email: user.email! },
            });

            if (pendingInvites.length > 0) {
              for (const invite of pendingInvites) {
                await prisma.groupMember.upsert({
                  where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
                  update: {},
                  create: { groupId: invite.groupId, userId: user.id, role: "MEMBER" },
                }).catch(() => {}); // ignore if already member
              }
              // Delete accepted invites
              await prisma.groupInvite.deleteMany({ where: { email: user.email! } });
            }
          } catch (dbErr) {
            console.error("[auth/callback] DB error:", dbErr);
            // Auth succeeded — still redirect
          }
        }
        return NextResponse.redirect(`${origin}${next}`);
      }

      console.error("[auth/callback] exchangeCodeForSession error:", error);
    } catch (err) {
      console.error("[auth/callback] unexpected error:", err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
