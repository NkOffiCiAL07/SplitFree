import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The database client's safety settings are what keep the app up in a traffic burst; pin them so nobody removes them by accident.
const src = readFileSync("src/lib/prisma.ts", "utf8");

describe("database client is configured for serverless load", () => {
  it("handles dropped idle connections instead of crashing the server instance", () => {
    expect(src).toMatch(/pool\.on\("error"/);
  });
  it("fails fast rather than hanging: connection, statement and query time limits", () => {
    expect(src).toMatch(/connectionTimeoutMillis:\s*8_000/);
    expect(src).toMatch(/statement_timeout:\s*20_000/);
    expect(src).toMatch(/query_timeout:\s*25_000/);
  });
  it("returns idle connections quickly, and lets the pool size be tuned without a code change", () => {
    expect(src).toMatch(/idleTimeoutMillis:\s*10_000/);
    expect(src).toMatch(/process\.env\.DB_POOL_MAX/);
    const def = /Number\(process\.env\.DB_POOL_MAX\) > 0 \? Number\(process\.env\.DB_POOL_MAX\) : (\d+)/.exec(src);
    expect(Number(def?.[1])).toBeGreaterThanOrEqual(5);
    expect(Number(def?.[1])).toBeLessThanOrEqual(10); // many instances × this must stay inside the database's connection limit
  });
  it("lets a transaction wait for a connection in a burst (the default 2 s made half of them fail)", () => {
    const m = /transactionOptions:\s*\{\s*maxWait:\s*([\d_]+),\s*timeout:\s*([\d_]+)/.exec(src);
    expect(Number(m?.[1].replace(/_/g, ""))).toBeGreaterThanOrEqual(10_000);
    expect(Number(m?.[2].replace(/_/g, ""))).toBeGreaterThanOrEqual(15_000);
  });
  it("keeps phone numbers out of every query by default", () => {
    expect(src).toContain("omit: { user: { phone: true } }");
  });
});
