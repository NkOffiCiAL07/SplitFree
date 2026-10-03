#!/usr/bin/env node
/** Temporary account for the iPhone UI tests:  node scripts/ui-test-account.mjs create|delete  (writes /tmp/splitr-ui/creds.json) */
import dotenv from "dotenv"; import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
dotenv.config({ path: ".env.local", quiet: true });
const dir = "/tmp/splitr-ui", file = `${dir}/creds.json`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
if (process.argv[2] === "create") {
  mkdirSync(dir, { recursive: true });
  const email = `ios-ui-test-${Date.now()}@example.com`, password = "Ui-Test-" + Math.random().toString(36).slice(2, 10) + "A1";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "iOS UI Test" } });
  if (error) { console.error(error.message); process.exit(1); }
  writeFileSync(file, JSON.stringify({ email, password, id: data.user.id }));
  console.log("created", email);
} else if (process.argv[2] === "delete" && existsSync(file)) {
  const { id } = JSON.parse(readFileSync(file, "utf8"));
  const u = new URL(process.env.DATABASE_URL);
  const db = new pg.Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres.fmumpgzlpooywxmkddvs", password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query("delete from users where id=$1", [id]).catch(() => {});
  await db.query("delete from groups where created_by_id=$1", [id]).catch(() => {});
  await db.end();
  await admin.auth.admin.deleteUser(id).catch(() => {});
  rmSync(file);
  console.log("deleted temporary account");
}
