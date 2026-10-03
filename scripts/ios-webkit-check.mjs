#!/usr/bin/env node
/**
 * iPhone check in a real WebKit engine (Safari's engine) with iPhone screen profiles — runs without Xcode.
 *   npm run ios:webkit                      starts `next start` itself (run `npm run build` first)
 *   npm run ios:webkit -- --base https://splitfree-xi.vercel.app     test a deployed site instead
 *
 * Two scenarios per device:
 *   safari — a normal Safari visit
 *   app    — imitates the iPhone app's web view (user agent without "Safari", plus our SplitrProApp token)
 * Screenshots go to ios/simulation/. Exits 1 if any check fails.
 */
import { webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const baseArg = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const PORT = 3125;
const BASE = baseArg ?? `http://localhost:${PORT}`;
const DEVICES = ["iPhone SE", "iPhone 13", "iPhone 15", "iPhone 15 Pro Max"].filter((d) => devices[d]);
mkdirSync("ios/simulation", { recursive: true });

let server = null;
if (!baseArg) {
  server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/login")).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const results = [];
const check = (device, scenario, name, ok, detail = "") => results.push({ device, scenario, name, ok: !!ok, detail: String(detail) });
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SplitrProApp/1.0";

const browser = await webkit.launch();
try {
  for (const name of DEVICES) {
    for (const scenario of ["safari", "app"]) {
      const d = devices[name];
      const ctx = await browser.newContext({ ...d, ...(scenario === "app" ? { userAgent: APP_UA } : {}) });
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::|the server responded/i.test(m.text())) problems.push(`console: ${m.text()}`); });
      const H = d.viewport.height;
      const tag = `${name.replace(/\s+/g, "-")}-${scenario}`;

      // ── sign-in page
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.waitForSelector("#email");
      await page.waitForTimeout(900); // entrance animations
      const m = await page.evaluate(() => {
        const r = (s) => document.querySelector(s)?.getBoundingClientRect();
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sign in");
        const google = [...document.querySelectorAll("button")].find((b) => /google/i.test(b.textContent));
        return {
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          emailFont: parseFloat(getComputedStyle(document.querySelector("#email")).fontSize),
          emailH: r("#email").height, passH: r("#password").height, btnH: btn.getBoundingClientRect().height,
          btnBottom: btn.getBoundingClientRect().bottom, vh: innerHeight,
          googleCount: google ? 1 : 0, inappNotice: !!document.querySelector("[data-testid=inapp-notice]"),
          themeColor: document.querySelector("meta[name=theme-color]")?.content,
          viewport: document.querySelector("meta[name=viewport]")?.content,
          emailAuto: document.querySelector("#email").autocomplete, passAuto: document.querySelector("#password").autocomplete,
        };
      });
      check(name, scenario, "login: no sideways scrolling", !m.overflowX);
      check(name, scenario, "login: inputs are ≥16px (iOS won't zoom on focus)", m.emailFont >= 16, `${m.emailFont}px`);
      check(name, scenario, "login: fields and button are ≥44px tall (thumb targets)", Math.min(m.emailH, m.passH, m.btnH) >= 44, `${Math.round(m.emailH)}/${Math.round(m.passH)}/${Math.round(m.btnH)}`);
      if (H >= 667) check(name, scenario, "login: Sign in is visible without scrolling", m.btnBottom <= H, `${Math.round(m.btnBottom)} of ${H}`);
      check(name, scenario, "login: password-manager hints", m.emailAuto === "username" && m.passAuto === "current-password", `${m.emailAuto}/${m.passAuto}`);
      check(name, scenario, "login: viewport-fit=cover, no zoom lock", /viewport-fit=cover/.test(m.viewport) && !/maximum-scale|user-scalable/.test(m.viewport), m.viewport);
      if (scenario === "safari") {
        check(name, scenario, "login: Google button available in Safari", m.googleCount === 1);
        check(name, scenario, "login: no 'other app's browser' warning in Safari", !m.inappNotice);
      } else {
        check(name, scenario, "app: Google button hidden (Google refuses web views)", m.googleCount === 0);
        check(name, scenario, "app: no 'other app's browser' warning", !m.inappNotice);
      }

      // typing fills the pot
      await page.fill("#email", "nishant@example.com");
      await page.fill("#password", "abcdefgh");
      await page.waitForTimeout(1300);
      const level = await page.evaluate(() => document.querySelector("[data-testid=filling-pot-sm]")?.getAttribute("data-level"));
      check(name, scenario, "login: the pot fills as the form is completed", level === "1", `level ${level}`);
      await page.screenshot({ path: `ios/simulation/${tag}-login.png` });

      // ── landing (Safari scenario only: the app opens on the dashboard)
      if (scenario === "safari") {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        await page.waitForTimeout(700);
        const l = await page.evaluate(() => ({
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          h1: document.querySelector("h1")?.textContent,
          iphoneTab: document.querySelector("#tab-iphone")?.getAttribute("aria-selected"),
          steps: !!document.querySelector("[data-testid=ios-steps]"),
          apkInIphonePanel: !!document.querySelector("#panel-iphone [data-testid=android-download]"),
          signIn: [...document.querySelectorAll("a")].filter((a) => a.textContent.trim() === "Sign in").length,
        }));
        check(name, scenario, "landing: no sideways scrolling", !l.overflowX);
        check(name, scenario, "landing: new tagline", /Hisaab saaf/.test(l.h1 ?? ""), l.h1);
        check(name, scenario, "landing: opens on the iPhone install tab with the Add-to-Home-Screen steps", l.iphoneTab === "true" && l.steps);
        check(name, scenario, "landing: no Android APK offered to an iPhone", !l.apkInIphonePanel);
        await page.screenshot({ path: `ios/simulation/${tag}-landing.png` });
      }

      check(name, scenario, "no JavaScript errors", problems.length === 0, problems.join(" | ").slice(0, 200));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
}

const failed = results.filter((r) => !r.ok);
const byDevice = [...new Set(results.map((r) => `${r.device} · ${r.scenario}`))];
for (const key of byDevice) {
  const rows = results.filter((r) => `${r.device} · ${r.scenario}` === key);
  console.log(`\n${key}  — ${rows.filter((r) => r.ok).length}/${rows.length} passed`);
  for (const r of rows) console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail && !r.ok ? `  [${r.detail}]` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ios/simulation/`);
process.exit(failed.length ? 1 : 0);
