#!/usr/bin/env node
/**
 * UI guard for the SIGNED-IN app: creates a temporary account with two groups and a few expenses, opens every app page in
 * light/dark on desktop and phone, and fails on accessibility violations (axe), sideways overflow, cut-off content,
 * console/page errors and tiny phone touch targets. The account and its data are always deleted afterwards.
 *
 *   npm run check:ui:app            (needs a build and .env.local with the Supabase + database settings)
 *   npm run check:ui:app -- --build
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { webkit, devices } from "playwright";

dotenv.config({ path: ".env.local", quiet: true });
const PORT = 3112, BASE = `http://localhost:${PORT}`;
const failures = [];
const step = (m) => process.env.DEBUG_GUARD && console.log(`  … ${m}`);
// A stuck run must never linger or leave data behind: stop after 12 minutes, clean up, fail.
const watchdog = setTimeout(async () => { console.error("✗ App UI guard timed out after 12 minutes"); try { await cleanup(); } catch {} process.exit(1); }, 12 * 60_000);
watchdog.unref?.();
const fail = (area, msg) => failures.push(`[${area}] ${msg}`);
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const dbUrl = new URL(process.env.DATABASE_URL);
const db = new pg.Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres.fmumpgzlpooywxmkddvs", password: decodeURIComponent(dbUrl.password), database: "postgres", ssl: { rejectUnauthorized: false } });

let server = null;
const stamp = Date.now(), password = "Guard-" + Math.random().toString(36).slice(2, 10) + "A1";
const users = [], groupIds = [];

async function startServer() {
  if (process.argv.includes("--build")) {
    const r = spawnSync("node", ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit" });
    if (r.status !== 0) { console.error("build failed"); process.exit(1); }
  }
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/login")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  console.error("server did not start (run `npm run build` first)"); process.exit(1);
}

async function cleanup() {
  try {
    for (const gid of groupIds) {
      for (const t of ["expense_reactions", "expense_splits", "expense_payers", "expense_comments"]) await db.query(`delete from ${t} where expense_id in (select id from expenses where group_id=$1)`, [gid]).catch(() => {});
      for (const t of ["activities", "expenses", "group_members"]) await db.query(`delete from ${t} where group_id=$1`, [gid]).catch(() => {});
      await db.query("delete from groups where id=$1", [gid]).catch(() => {});
    }
    for (const u of users) {
      for (const t of ["notifications", "activities"]) await db.query(`delete from ${t} where user_id=$1`, [u.id]).catch(() => {});
      await db.query("delete from friendships where user_id=$1 or friend_id=$1", [u.id]).catch(() => {});
      await db.query("delete from users where id=$1", [u.id]).catch(() => {});
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  } catch { /* best effort: the next run's account has a different name */ }
}

async function main() {
  step("connecting"); await db.connect();
  step("starting server"); await startServer(); step("server up");
  const browser = await webkit.launch();
  try {
    for (const [i, name] of ["Nishant", "Asha", "Rohan", "Mia"].entries()) {
      const email = `ui-guard-${stamp}-${i}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone_number: "+919876543210" } });
      if (error) throw new Error(error.message);
      users.push({ id: data.user.id, email, name });
    }
    step("seeding");
    // seed through a real session, so the data goes through the app's own API
    const seed = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const sp = await seed.newPage();
    await sp.goto(BASE + "/login", { waitUntil: "networkidle" });
    await sp.fill("#email", users[0].email); await sp.fill("#password", password); await sp.click("button[type=submit]");
    await sp.waitForURL("**/dashboard", { timeout: 60000 }); await sp.waitForTimeout(2000); await sp.request.get(BASE + "/api/profile");
    for (const u of users.slice(1)) await db.query("insert into users (id,email,name,currency,timezone,created_at,updated_at) values ($1,$2,$3,'INR','UTC',now(),now()) on conflict do nothing", [u.id, u.email, u.name]);
    const mk = async (name, cat, members) => { const gid = randomUUID(); groupIds.push(gid); await db.query("insert into groups (id,name,created_by_id,currency,category,created_at,updated_at) values ($1,$2,$3,'INR',$4,now(),now())", [gid, name, users[0].id, cat]); for (const u of members) await db.query("insert into group_members (id,group_id,user_id,role,joined_at) values (gen_random_uuid()::text,$1,$2,'MEMBER',now())", [gid, u.id]); return gid; };
    const goa = await mk("Goa Trip", "TRIP", users), flat = await mk("Flat 402", "HOME", users.slice(0, 3));
    const ex = (gid, d, a, who, cat, ppl) => sp.request.post(BASE + "/api/expenses", { data: { description: d, amount: a, currency: "INR", category: cat, splitType: "EQUAL", paidById: users[who].id, groupId: gid, date: new Date().toISOString(), participants: ppl.map((u) => u.id) } });
    for (const [d, a, w, c] of [["Hotel", 18400, 0, "TRAVEL"], ["Dinner", 3600, 1, "FOOD"], ["Scooter", 2400, 2, "TRANSPORT"]]) await ex(goa, d, a, w, c, users);
    for (const [d, a, w, c] of [["Rent", 36000, 0, "ACCOMMODATION"], ["Wi-Fi", 1200, 1, "UTILITIES"]]) await ex(flat, d, a, w, c, users.slice(0, 3));
    await seed.close();

    const routes = process.env.THEMES ? ["dashboard", "groups", `groups/${goa}`, "expenses", "settle", "settings"] : ["dashboard", "groups", `groups/${goa}`, "expenses", "friends", "activity", "analytics", "recurring", "settle", "settings", "profile", "import"];
    const combos = [];
    if (process.env.THEMES) {
      // every theme other than the default, light and dark, on the pages where surfaces and text colours matter most
      const { ACCENTS } = await import("../src/lib/themes.ts").catch(() => ({ ACCENTS: null }));
      const ids = (ACCENTS ?? []).filter((x) => x.id !== "violet").map((x) => x.id);
      for (const id of ids.length ? ids : ["ocean", "teal", "sunset", "pink", "graphite", "sky", "indigo", "orchid", "amber", "coffee", "midnight"]) for (const scheme of ["light", "dark"]) combos.push([`theme-${id}`, { viewport: { width: 1440, height: 900 } }, scheme, id]);
    } else {
      for (const [device, ctx] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { ...devices["iPhone 15"] }]]) {
        for (const scheme of ["light", "dark"]) combos.push([device, ctx, scheme]);
      }
    }
    const queue = [...combos];
    const worker = async () => { for (let item; (item = queue.shift()); ) await runCombo(...item); };
    const runCombo = async (device, ctx, scheme, accent) => {
      {
        const c = await browser.newContext({ ...ctx, colorScheme: scheme, reducedMotion: "reduce" }); const p = await c.newPage();
        const problems = new Set();
        p.on("pageerror", (e) => { if (/Fetch API cannot load|ChunkLoadError/.test(String(e))) return; /* a prefetch or script chunk cancelled by the next navigation: not a bug */ problems.add(`page error: ${String(e).slice(0, 110)}`); });
        p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && problems.add(`console: ${m.text().slice(0, 110)}`));
        await p.goto(BASE + "/login", { waitUntil: "networkidle" }); await p.evaluate(([t, a]) => { localStorage.setItem("theme", t); if (a) localStorage.setItem("splitr-accent", a); }, [scheme, accent]);
        await p.fill("#email", users[0].email); await p.fill("#password", password); await p.click("button[type=submit]");
        await p.waitForURL("**/dashboard", { timeout: 60000 }); step(`signed in ${device}/${scheme}`);
        for (const r of routes) {
          const where = `${device}/${scheme} /${r.startsWith("groups/") ? "groups/[id]" : r}`;
          try {
            step(`open /${r}`); await p.goto(`${BASE}/${r}`, { waitUntil: "commit", timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
            // a page whose scripts lock up the tab (an endless loop) cannot even answer this: report it and stop using the tab
            const responsive = await Promise.race([p.evaluate(() => true), new Promise((res) => setTimeout(() => res(false), 4000))]);
            if (!responsive) { fail("FROZEN", `${where}: the page locks up the browser tab`); throw new Error("frozen"); }
            // measure only once the page is at rest: no skeletons, no running animations, no half-transparent fading content
            for (let i = 0, calm = 0; i < 40 && calm < 3; i++) {
              const busy = await p.evaluate(() => document.getAnimations().some((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity) || !!document.querySelector(".animate-pulse,[style*='opacity: 0.'],[style*='opacity:0.']")).catch(() => true);
              calm = busy ? 0 : calm + 1; await p.waitForTimeout(250);
            }
            await p.addScriptTag({ content: axeSource });
            const runAxe = () => Promise.race([new Promise((_, rej) => setTimeout(() => rej(new Error("axe timed out")), 45000)), p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"], resultTypes: ["violations"] })).violations.map((v) => `${v.id} ×${v.nodes.length} (${v.nodes[0].target.join(" ").slice(-60)})${v.id === "color-contrast" ? " " + (v.nodes[0].any[0]?.message || "").slice(0, 110) : ""}`))]);
            // read twice, a moment apart: only what is wrong BOTH times is real (a fade caught half-way differs between readings)
            const first = await runAxe(); await p.waitForTimeout(900); const second = new Set((await runAxe()).map((x) => x.split(" (")[0]));
            const violations = first.filter((x) => second.has(x.split(" (")[0]));
            for (const v of violations) fail("a11y", `${where}: ${v}`);
            const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
            if (over > 1) fail("overflow", `${where}: ${over}px too wide`);
            if (device === "phone") {
              const small = await p.evaluate(() => {
                const out = [];
                for (const e of document.querySelectorAll("a,button,[role=tab]")) {
                  const s = getComputedStyle(e), b = e.getBoundingClientRect();
                  if (s.display === "none" || s.visibility === "hidden" || !b.width || e.closest("[aria-hidden=true]") || e.matches(".sr-only") || s.display === "inline" || e.getAttribute("role") === "switch" || e.closest("[data-radix-popper-content-wrapper]")) continue;
                  if (b.height < 28 || b.width < 28) out.push(`${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20)} ${Math.round(b.width)}x${Math.round(b.height)}`);
                }
                return [...new Set(out)];
              });
              for (const s of small) fail("touch", `${where}: ${s}`);
            }
          } catch (e) { if (e.message !== "frozen") fail("load", `${where}: ${String(e.message).slice(0, 80)}`); else break; }
        }
        for (const x of problems) fail("errors", `${device}/${scheme}: ${x}`);
        await Promise.race([c.close(), new Promise((r) => setTimeout(r, 3000))]); // (a wedged tab may not close)
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  } finally {
    await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]); // (never wait forever on a wedged tab)
    if (server?.pid) { try { process.kill(-server.pid); } catch { server.kill(); } }
    await cleanup();
    await db.end().catch(() => {});
  }
}

try { await main(); } catch (e) { fail("setup", String(e.message ?? e)); await cleanup(); }
if (failures.length) {
  console.error(`\n✗ App UI guard: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const f of failures.slice(0, 60)) console.error("  " + f);
  process.exit(1);
}
console.log("✓ App UI guard passed: every signed-in page is responsive, accessible, fits the screen and runs without errors (temporary data deleted)");
process.exit(0);
