import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Local token verification (no auth-server round trip on every page navigation); this call also
  // refreshes an expired session and writes the new cookies onto the response.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const url = request.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup") ||
    url.pathname.startsWith("/reset-password");
  const isApiRoute = url.pathname.startsWith("/api");
  const isPublicRoute = url.pathname === "/" || url.pathname.startsWith("/auth") || url.pathname.startsWith("/join") || url.pathname === "/offline" || url.pathname === "/privacy" || url.pathname === "/support" || url.pathname.startsWith("/downloads/");

  // The iPhone app never shows the marketing page (its "home" is the dashboard); signed-out people continue on to sign-in
  if (url.pathname === "/" && (request.headers.get("user-agent") ?? "").includes("SplitrProApp")) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && !isAuthRoute && !isApiRoute && !isPublicRoute) {
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    url.pathname = "/dashboard";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
