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
    // Serverless: many instances can be alive at once and EACH holds its own pool, so the total is instances × max. 5 is safe
    // even on a direct database connection; behind Supabase's transaction pooler (port 6543) set DB_POOL_MAX=10 or more.
    // (Measured: with 3, a burst of 90 simultaneous requests failed half of them waiting for a connection.)
    max: Number(process.env.DB_POOL_MAX) > 0 ? Number(process.env.DB_POOL_MAX) : 5,
    idleTimeoutMillis: 10_000, // return idle connections to the database soon, so a quiet instance holds none
    connectionTimeoutMillis: 8_000, // can't get a connection (database busy)? say so in 8s rather than hang the request
    statement_timeout: 20_000, // a runaway query is cancelled by the database after 20s…
    query_timeout: 25_000, // …and abandoned by the driver shortly after
    allowExitOnIdle: true,
  });
  // An idle connection can be dropped by the network or a database restart. Without a listener that "error" event is
  // thrown and crashes the whole instance (every request it is serving); with one, the pool just opens a fresh connection.
  pool.on("error", (err) => {
    console.error("[db] idle connection error (a new one will be opened):", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // A person's mobile number is private: it is left out of EVERY query (including the many that load other people's
    // user rows, like group members or who paid) unless the code explicitly asks for it with `omit: { phone: false }`
    // (only the owner's own profile and data export do).
    omit: { user: { phone: true } },
    // A transaction (creating an expense, joining a group…) waits for a free connection; the default is only 2 seconds, after
    // which it fails with "Unable to start a transaction in the given time" — exactly what happens in a traffic burst.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
