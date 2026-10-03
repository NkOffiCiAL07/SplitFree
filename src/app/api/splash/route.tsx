import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "@/lib/app-config";
import { SPLASH_MAX, SPLASH_MIN } from "@/lib/ios-splash";
import { brandMarkSvg } from "@/lib/brand-mark";

/** GET /api/splash?w=1170&h=2532 — the iOS launch image: brand gradient, logo and name. Cached forever per size. */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const w = Number(q.get("w"));
  const h = Number(q.get("h"));
  if (![w, h].every((n) => Number.isInteger(n) && n >= SPLASH_MIN && n <= SPLASH_MAX)) {
    return NextResponse.json({ error: { message: "w and h must be whole numbers between 300 and 3000" } }, { status: 400 });
  }
  const tile = Math.round(Math.min(w, h) * 0.26);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(160deg, #6d28d9 0%, #4f46e5 55%, #7c3aed 100%)", color: "white",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG by next/og, not shown in a page */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(brandMarkSvg({ size: tile, variant: "rounded" })).toString("base64")}`}
          width={tile}
          height={tile}
          alt=""
          style={{ borderRadius: tile * 0.27, boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }}
        />
        <div style={{ marginTop: tile * 0.22, fontSize: tile * 0.2, fontWeight: 700, letterSpacing: -1 }}>{APP_NAME}</div>
      </div>
    ),
    { width: w, height: h, headers: { "Cache-Control": "public, max-age=31536000, immutable" } }
  );
}
