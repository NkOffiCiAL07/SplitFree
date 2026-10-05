import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  // Use WHATWG URL to correctly decode percent-encoded credentials (e.g. %40 → @)
  // and pass each field separately so pg never has to re-parse a URL with @ in the password.
  const u = new URL(connectionString);
  const pool = new Pool({
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
    max: 3, // keep pool small for serverless
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // A person's mobile number is private: it is left out of EVERY query (including the many that load other people's
    // user rows, like group members or who paid) unless the code explicitly asks for it with `omit: { phone: false }`
    // (only the owner's own profile and data export do).
    omit: { user: { phone: true } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
