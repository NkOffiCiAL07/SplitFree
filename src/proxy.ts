import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://") &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.next({ request });
  }
  // API route handlers authenticate themselves via getAuthUser(); skipping the
  // proxy's getUser() here avoids a duplicate Supabase round trip per API call.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|\\.well-known|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
