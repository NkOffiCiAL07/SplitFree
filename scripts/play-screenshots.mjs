#!/usr/bin/env node
/**
 * Google Play graphics from the REAL app: creates a temporary demo account (Goa trip, flat rent, a few expenses),
 * screenshots the phone UI, frames each shot with a caption, and writes play-store/assets/*.png. Everything it creates is
 * deleted afterwards.   npm run play:assets   (needs a build and .env.local; starts its own server on port 3114)
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { webkit } from "playwright";

dotenv.config({ path: ".env.local", quiet: true });
const PORT = 3114, BASE = `http://localhost:${PORT}`, OUT = "play-store/assets";
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const u = new URL(process.env.DATABASE_URL);
const db = new pg.Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres.fmumpgzlpooywxmkddvs", password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false } });
const stamp = Date.now(), password = "Play-" + Math.random().toString(36).slice(2, 10) + "A1";
const people = [["Nishant", 0], ["Asha", 1], ["Rohan", 2], ["Mia", 3]]; const users = []; const groupIds = [];
let server = null;

async function cleanup() {
  for (const gid of groupIds) {
    for (const t of ["expense_reactions", "expense_splits", "expense_payers", "expense_comments"]) await db.query(`delete from ${t} where expense_id in (select id from expenses where group_id=$1)`, [gid]).catch(() => {});
    for (const t of ["activities", "settlements", "expenses", "group_members"]) await db.query(`delete from ${t} where group_id=$1`, [gid]).catch(() => {});
    await db.query("delete from groups where id=$1", [gid]).catch(() => {});
  }
  for (const x of users) {
    for (const t of ["notifications", "activities"]) await db.query(`delete from ${t} where user_id=$1`, [x.id]).catch(() => {});
    await db.query("delete from friendships where user_id=$1 or friend_id=$1", [x.id]).catch(() => {});
    await db.query("delete from users where id=$1", [x.id]).catch(() => {});
    await admin.auth.admin.deleteUser(x.id).catch(() => {});
  }
}

const frame = async (browser, shotPath, headline, sub, outPath, grad) => {
  const img = readFileSync(shotPath).toString("base64");
  const html = `<html><body style="margin:0;width:1080px;height:1920px;overflow:hidden;font-family:-apple-system,Inter,Helvetica,Arial,sans-serif;background:${grad};position:relative">
    <div style="position:absolute;top:96px;left:72px;right:72px;color:#fff"><div style="font-size:84px;font-weight:800;line-height:1.04;letter-spacing:-2px">${headline}</div><div style="margin-top:22px;font-size:36px;opacity:.85">${sub}</div></div>
    <div style="position:absolute;left:150px;right:150px;top:470px;bottom:-60px;border-radius:72px 72px 0 0;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.45);border:10px solid #0b0c12;border-bottom:none;background:#fff">
      <img src="data:image/png;base64,${img}" style="width:100%;display:block"/></div></body></html>`;
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.waitForTimeout(300); await p.screenshot({ path: outPath }); await p.close();
};

async function main() {
  await db.connect();
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/login")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  const browser = await webkit.launch();
  try {
    for (const [name, i] of people) {
      const email = `play-demo-${stamp}-${i}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone_number: "+919876543210" } });
      if (error) throw new Error(error.message);
      users.push({ id: data.user.id, email, name });
    }
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce", colorScheme: "light" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/login", { waitUntil: "networkidle" }); await p.evaluate(() => { localStorage.setItem("theme", "light"); localStorage.setItem("splitfree_onboarding_dismissed", "1"); });
    await p.fill("#email", users[0].email); await p.fill("#password", password); await p.click("button[type=submit]");
    await p.waitForURL("**/dashboard", { timeout: 60000 }); await p.waitForTimeout(2000); await p.request.get(BASE + "/api/profile");
    for (const x of users.slice(1)) await db.query("insert into users (id,email,name,currency,timezone,created_at,updated_at) values ($1,$2,$3,'INR','Asia/Kolkata',now(),now()) on conflict do nothing", [x.id, x.email, x.name]);
    const mk = async (name, cat, members) => { const gid = randomUUID(); groupIds.push(gid); await db.query("insert into groups (id,name,created_by_id,currency,category,created_at,updated_at) values ($1,$2,$3,'INR',$4,now(),now())", [gid, name, users[0].id, cat]); for (const x of members) await db.query("insert into group_members (id,group_id,user_id,role,joined_at) values (gen_random_uuid()::text,$1,$2,'MEMBER',now())", [gid, x.id]); return gid; };
    const goa = await mk("Goa Trip", "TRIP", users), flat = await mk("Flat 402", "HOME", users.slice(0, 3)), chai = await mk("Chai & snacks", "FRIENDS", users.slice(0, 2));
    const ex = (gid, d, a, who, cat, ppl, daysAgo = 3) => p.request.post(BASE + "/api/expenses", { data: { description: d, amount: a, currency: "INR", category: cat, splitType: "EQUAL", paidById: users[who].id, groupId: gid, date: new Date(Date.now() - daysAgo * 864e5).toISOString(), participants: ppl.map((x) => x.id) } });
    for (const [d, a, w, c, ago] of [["Hotel — 3 nights", 8400, 0, "ACCOMMODATION", 6], ["Dinner at Barbeque Nation", 3600, 1, "FOOD", 5], ["Scooter rental", 2400, 2, "TRANSPORT", 4], ["Beach shack lunch", 2800, 3, "FOOD", 3], ["Airport cab", 1250, 0, "TRANSPORT", 2]]) await ex(goa, d, a, w, c, users, ago);
    for (const [d, a, w, c, ago] of [["Rent — October", 32000, 1, "ACCOMMODATION", 7], ["Wi-Fi bill", 1200, 0, "UTILITIES", 5], ["Groceries", 2200, 2, "FOOD", 1]]) await ex(flat, d, a, w, c, users.slice(0, 3), ago);
    await ex(chai, "Chai and samosas", 420, 1, "FOOD", users.slice(0, 2), 1);

    const shots = [];
    const snap = async (path, name, prep) => { await p.goto(BASE + path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3500); if (prep) await prep(); await p.waitForTimeout(600); const f = `/tmp/${name}.png`; await p.screenshot({ path: f }); shots.push(f); return f; };
    await snap("/dashboard", "s1");
    await snap("/settle", "s3");
    await snap(`/groups/${goa}`, "s4");
    await snap("/groups", "s5");
    // 2: the add-expense form with a split chosen
    await p.goto(BASE + `/groups/${goa}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3000);
    await p.getByRole("button", { name: /add expense/i }).first().click(); await p.waitForTimeout(1800);
    await p.screenshot({ path: "/tmp/s2.png" });
    await p.keyboard.press("Escape");
    // 6: offline: add an expense with no connection; it is saved on the phone and syncs later
    await p.goto(BASE + `/dashboard`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3500);
    await ctx.setOffline(true); await p.waitForTimeout(1500);
    await p.screenshot({ path: "/tmp/s6.png" });
    await ctx.setOffline(false);

    const G = ["linear-gradient(160deg,#4f48e6,#7c5cff 60%,#38bdf8)", "linear-gradient(160deg,#3a52a8,#635bff)", "linear-gradient(160deg,#0f172a,#4f48e6)", "linear-gradient(160deg,#5148f0,#a21caf)", "linear-gradient(160deg,#1d4ed8,#6366f1)", "linear-gradient(160deg,#0b7a4f,#0369a1)"];
    const caps = [["Hisaab saaf.<br>Dosti barkaraar.", "Your balances at a glance"], ["Split bills<br>your way.", "Equal, exact, percentage or shares"], ["Settle up in<br>fewer payments.", "Smart settle-up does the maths"], ["Never lose track of who owes what.", "Clear balances, in every group"], ["Made for real-life money moments.", "Trips, rent, dinners and more"], ["Works even when you're offline.", "Saved on your phone, synced later"]];
    const files = ["/tmp/s1.png", "/tmp/s2.png", "/tmp/s3.png", "/tmp/s4.png", "/tmp/s5.png", "/tmp/s6.png"];
    for (let i = 0; i < 6; i++) await frame(browser, files[i], caps[i][0], caps[i][1], `${OUT}/screenshot-${i + 1}.png`, G[i]);

    // feature graphic 1024x500 and the 512 icon
    const icon = readFileSync("public/icons/icon-512x512.png").toString("base64");
    const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    await fg.setContent(`<html><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:-apple-system,Inter,Helvetica,Arial,sans-serif;background:linear-gradient(120deg,#2f2b8f,#5148f0 55%,#7c5cff);color:#fff;display:flex;align-items:center;padding:0 72px;box-sizing:border-box;gap:56px">
      <img src="data:image/png;base64,${icon}" style="width:190px;height:190px;border-radius:44px;box-shadow:0 20px 60px rgba(0,0,0,.35)"/>
      <div><div style="font-size:92px;font-weight:800;letter-spacing:-3px;line-height:1">Splitr</div><div style="font-size:38px;margin-top:14px;opacity:.92;line-height:1.25">Hisaab saaf. Dosti barkaraar.</div><div style="font-size:26px;margin-top:14px;opacity:.75">Split bills, track balances, settle up.</div></div></body></html>`);
    await fg.screenshot({ path: `${OUT}/feature-graphic.png` }); await fg.close();
    writeFileSync(`${OUT}/icon-512.png`, readFileSync("public/icons/icon-512x512.png"));
    await ctx.close();
  } finally {
    await browser.close(); if (server?.pid) { try { process.kill(-server.pid); } catch { server.kill(); } }
    await cleanup(); await db.end().catch(() => {});
  }
}
try { await main(); console.log("✓ wrote", OUT); } catch (e) { console.error("✗", e.message); await cleanup().catch(() => {}); process.exit(1); }
process.exit(0);
