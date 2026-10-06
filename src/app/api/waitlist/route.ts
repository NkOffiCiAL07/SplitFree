import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError, rateLimit, clientIp } from "@/lib/api-helpers";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  // a hidden field real people never fill in: bots do
  website: z.string().optional(),
});

/** POST /api/waitlist — "tell me when the iPhone app launches". Public (no sign-in), so it is rate-limited by address. */
export async function POST(req: NextRequest) {
  // Generous (a family or office shares one address) but enough to stop someone filling the table with junk
  if (rateLimit(`waitlist:${clientIp(req)}`, 20, 60 * 60_000)) return err("Too many requests — please try again later", 429);
  try {
    const { email, website } = schema.parse(await req.json());
    if (website) return ok({ joined: true }); // a bot: pretend it worked, store nothing
    // Idempotent, and it never reveals whether an address was already on the list
    await prisma.waitlistEntry.upsert({ where: { email }, update: {}, create: { email, platform: "ios" } });
    return ok({ joined: true });
  } catch (e) {
    return handleError(e);
  }
}
