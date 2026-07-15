import { NextResponse } from "next/server";

export async function POST() {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) {
    return NextResponse.json({ error: "Demo mode is not configured" }, { status: 503 });
  }

  return NextResponse.json({ email, password });
}
