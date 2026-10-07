#!/usr/bin/env node
/**
 * UI guard: opens the public pages in a real browser and fails (exit 1) if anything that was fixed has regressed.
 *
 *   npm run check:ui                 build must exist (npm run build); starts `next start` on port 3111 itself
 *   npm run check:ui -- --build      builds first
 *   BASE_URL=https://www.splitr.pro npm run check:ui     checks a deployed site instead (no server started)
 *
 * Checks, for light + dark and desktop + phone:
 *   1. zero WCAG A/AA violations (axe-core): contrast, labels, list markup, names
 *   2. no horizontal scrolling at 360 / 390 / 430 / 768 / 1024 / 1280 / 1440 px
 *   3. no console errors, page errors (incl. hydration) or failed requests
 *   4. phone touch targets are at least 30px
 *   5. sign-in and create-account cards are exactly the same size on desktop
 *   6. every internal link and #anchor on the landing page resolves
 *   7. the sign-in form still has its controls (Google, email, password with a show/hide toggle, Forgot password, Sign up link)
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { webkit, devices } from "playwright";

const PORT = 3111;
const BASE = process.env.BASE_URL?.replace(/\/$/, "") ?? `http://localhost:${PORT}`;
const PAGES = ["/", "/intl", "/login", "/signup", "/reset-password", "/privacy", "/support", "/delete-account"];
const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440];
const failures = [];
const fail = (area, msg) => { failures.push(`[${area}] ${msg}`); };

let server = null;
async function startServer() {
  if (process.env.BASE_URL) return;
  if (process.argv.includes("--build")) {
    const r = spawnSync("node", ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit" });
    if (r.status !== 0) { console.error("build failed"); process.exit(1); }
  }
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + "/login"); if (r.ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  console.error("server did not start (run `npm run build` first)"); process.exit(1);
}

const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

async function main() {
  await startServer();
  const browser = await webkit.launch();
  try {
    // 1 + 3 + 4: per pages, themes, devices
    for (const [device, ctx] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { ...devices["iPhone 15"] }]]) {
      for (const scheme of ["light", "dark"]) {
        const c = await browser.newContext({ ...ctx, colorScheme: scheme, reducedMotion: "reduce" });
        const p = await c.newPage();
        const problems = new Set();
        p.on("pageerror", (e) => problems.add(`page error: ${String(e).slice(0, 120)}`));
        p.on("console", (m) => m.type() === "error" && problems.add(`console: ${m.text().slice(0, 120)}`));
        p.on("response", (r) => { if (r.status() >= 400 && !/favicon|\/api\//.test(r.url())) problems.add(`${r.status()} ${r.url().slice(0, 80)}`); });
        await p.goto(BASE + "/login", { waitUntil: "networkidle" });
        await p.evaluate((t) => localStorage.setItem("theme", t), scheme);
        for (const path of PAGES) {
          const where = `${device}/${scheme} ${path}`;
          await p.goto(BASE + path, { waitUntil: "networkidle" });
          await p.reload({ waitUntil: "networkidle" });
          const h = await p.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < h; y += 600) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(40); }
          await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(900); // (lets scroll-triggered fades finish, so colours are measured at rest)

          await p.addScriptTag({ content: axeSource });
          const violations = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"], resultTypes: ["violations"] })).violations.map((v) => `${v.id} ×${v.nodes.length} (${v.nodes[0].target.join(" ").slice(-60)})`));
          for (const v of violations) fail("a11y", `${where}: ${v}`);

          if (device === "phone") {
            const small = await p.evaluate(() => {
              const out = [];
              for (const e of document.querySelectorAll("a,button,[role=tab]")) {
                const s = getComputedStyle(e), r = e.getBoundingClientRect();
                if (s.display === "none" || s.visibility === "hidden" || !r.width || e.closest("[aria-hidden=true]") || e.matches(".sr-only") || s.display === "inline") continue;
                if (r.height < 30 || r.width < 30) out.push(`${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 22)} ${Math.round(r.width)}x${Math.round(r.height)}`);
              }
              return [...new Set(out)];
            });
            for (const s of small) fail("touch", `${where}: ${s}`);
          }
        }
        for (const x of problems) fail("errors", `${device}/${scheme}: ${x}`);
        await c.close();
      }
    }

    // 2: overflow at every width
    for (const w of WIDTHS) {
      const c = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 }, isMobile: w < 500, hasTouch: w < 500 });
      const p = await c.newPage();
      for (const path of PAGES) {
        await p.goto(BASE + path, { waitUntil: "networkidle" });
        const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (over > 1) fail("overflow", `${w}px ${path}: ${over}px too wide`);
      }
      await c.close();
    }

    // 2b: nothing visible may stick out past the screen edge (the page clips sideways overflow, so it would be cut off silently)
    for (const w of [360, 390, 768, 1280]) {
      const c = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, hasTouch: w < 500, reducedMotion: "reduce" });
      const p = await c.newPage();
      for (const path of PAGES) {
        await p.goto(BASE + path, { waitUntil: "networkidle" });
        const cut = await p.evaluate(() => {
          const out = [];
          for (const e of document.querySelectorAll("body *")) {
            if (e.closest("[aria-hidden=true],.overflow-x-auto,.overflow-auto,svg,.lg-marquee,[data-decor]")) continue;
            const s = getComputedStyle(e), r = e.getBoundingClientRect();
            if (s.display === "none" || s.visibility === "hidden" || s.position === "fixed" || !r.width || !r.height) continue;
            if (r.right > innerWidth + 2 || r.left < -2) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")} ${Math.round(r.left)}→${Math.round(r.right)}`);
          }
          return out.slice(0, 3);
        });
        for (const x of cut) fail("cut-off", `${w}px ${path}: ${x}`);
      }
      await c.close();
    }

    // 5: card parity (desktop widths where the card exists)
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
      const c = await browser.newContext({ viewport: { width: w, height: h } });
      const p = await c.newPage(); const sizes = [];
      for (const path of ["/login", "/signup"]) {
        await p.goto(BASE + path, { waitUntil: "networkidle" });
        const b = await p.locator("[data-testid=auth-card]").boundingBox();
        sizes.push(b ? `${Math.round(b.width)}x${Math.round(b.height)}` : "missing");
      }
      if (sizes[0] !== sizes[1] || sizes.includes("missing")) fail("card-size", `${w}x${h}: sign-in ${sizes[0]} vs create-account ${sizes[1]}`);
      await c.close();
    }

    // 6 + 7
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await c.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const hrefs = await p.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))]);
    for (const h of hrefs) {
      if (h.startsWith("#")) { if (!(await p.evaluate((id) => !!document.getElementById(id), h.slice(1)))) fail("links", `missing anchor ${h}`); }
      else if (h.startsWith("/")) { const r = await p.request.get(BASE + h); if (r.status() >= 400) fail("links", `${h} → ${r.status()}`); }
    }
    await p.goto(BASE + "/login", { waitUntil: "networkidle" });
    const form = await p.evaluate(() => ({
      google: [...document.querySelectorAll("button")].some((b) => /continue with google/i.test(b.textContent || "")),
      email: !!document.querySelector("#email[type=email], #email"),
      password: !!document.querySelector("#password"),
      toggle: !!document.querySelector('button[aria-label*="password" i]'),
      forgot: !!document.querySelector('a[href^="/reset-password"]'),
      signup: !!document.querySelector('a[href^="/signup"]'),
      submit: !!document.querySelector("button[type=submit]"),
    }));
    for (const [k, ok] of Object.entries(form)) if (!ok) fail("login", `sign-in form lost its ${k}`);
    await c.close();
  } finally {
    await browser.close();
    if (server?.pid) { try { process.kill(-server.pid); } catch { server.kill(); } } // the whole process group: `next start` spawns a child
  }
}

await main();
if (failures.length) {
  console.error(`\n✗ UI guard: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const f of failures.slice(0, 60)) console.error("  " + f);
  process.exit(1);
}
console.log(`✓ UI guard passed (${BASE}): accessibility, overflow, errors, touch targets, card sizes, links and sign-in form are all intact`);
