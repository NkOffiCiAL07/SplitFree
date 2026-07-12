import { NextResponse } from "next/server";

const DEV_EMAIL = "dev@splitfree.local";
const DEV_PASSWORD = "DevPass123!";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const admin = await createAdminClient();

    const { error } = await admin.auth.admin.createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Dev User" },
    });

    // Ignore "already registered" — user exists, proceed
    if (error && !error.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ email: DEV_EMAIL, password: DEV_PASSWORD });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
