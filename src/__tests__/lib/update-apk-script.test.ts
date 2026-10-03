// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/update-apk.mjs");
const REAL_APK = resolve("public/downloads/SplitFree.apk");
const REAL_LINKS = readFileSync("public/.well-known/assetlinks.json", "utf8");
const hasKeytool = spawnSync("keytool", ["-help"], { stdio: "ignore" }).status !== null;

let dir: string;
const run = (apk: string, ...flags: string[]) => spawnSync("node", [SCRIPT, apk, ...flags], { cwd: dir, encoding: "utf8" });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "apk-"));
  mkdirSync(join(dir, "public/.well-known"), { recursive: true });
  mkdirSync(join(dir, "public/downloads"), { recursive: true });
  mkdirSync(join(dir, "src/lib"), { recursive: true });
  writeFileSync(join(dir, "public/.well-known/assetlinks.json"), REAL_LINKS);
  writeFileSync(join(dir, "src/lib/android-app.ts"), 'export const ANDROID_APP = {\n  sizeBytes: 1,\n  sha256: "' + "0".repeat(64) + '",\n} as const;\n');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("scripts/update-apk.mjs — publishing a new Android build safely", () => {
  it("refuses a missing file and a file that isn't an APK", () => {
    expect(run(join(dir, "nope.apk")).status).toBe(1);
    const html = join(dir, "fake.apk");
    writeFileSync(html, "<html>not an apk</html>");
    const r = run(html);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/isn't an APK/);
    expect(existsSync(join(dir, "public/downloads/SplitFree.apk"))).toBe(false); // nothing published
  });

  it("refuses a truncated zip (missing the manifest/code/signature)", () => {
    const f = join(dir, "partial.apk");
    writeFileSync(f, Buffer.concat([Buffer.from("PK"), Buffer.from("garbage without the entries")]));
    expect(run(f).status).toBe(1);
  });

  it.skipIf(!hasKeytool)("publishes a correctly signed APK: copies it and updates the size and SHA-256 the landing page shows", () => {
    const r = run(REAL_APK);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Signing key matches/);
    const bytes = readFileSync(REAL_APK);
    expect(readFileSync(join(dir, "public/downloads/SplitFree.apk")).equals(bytes)).toBe(true);
    const ts = readFileSync(join(dir, "src/lib/android-app.ts"), "utf8");
    expect(ts).toContain(`sizeBytes: ${bytes.length}`);
    expect(ts).toContain(`sha256: "${createHash("sha256").update(bytes).digest("hex")}"`);
  });

  it.skipIf(!hasKeytool)("REFUSES an APK signed with a different key than assetlinks.json trusts — and publishes nothing", () => {
    const links = JSON.parse(REAL_LINKS);
    links[0].target.sha256_cert_fingerprints = ["AA:" + "BB:".repeat(30) + "CC"];
    writeFileSync(join(dir, "public/.well-known/assetlinks.json"), JSON.stringify(links));
    const r = run(REAL_APK);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/signed with a DIFFERENT key/);
    expect(r.stderr).toMatch(/address bar/);
    expect(existsSync(join(dir, "public/downloads/SplitFree.apk"))).toBe(false);
    expect(readFileSync(join(dir, "src/lib/android-app.ts"), "utf8")).toContain("sizeBytes: 1,"); // untouched
  });

  it.skipIf(!hasKeytool)("--force publishes anyway (for a deliberate key change)", () => {
    const links = JSON.parse(REAL_LINKS);
    links[0].target.sha256_cert_fingerprints = ["AA:" + "BB:".repeat(30) + "CC"];
    writeFileSync(join(dir, "public/.well-known/assetlinks.json"), JSON.stringify(links));
    expect(run(REAL_APK, "--force").status).toBe(0);
    expect(existsSync(join(dir, "public/downloads/SplitFree.apk"))).toBe(true);
  });

  it("the committed assetlinks.json trusts the key the committed APK is signed with", () => {
    if (!hasKeytool) return;
    const out = execFileSync("keytool", ["-printcert", "-jarfile", REAL_APK], { encoding: "utf8" });
    const fp = out.match(/SHA256:\s*([0-9A-F:]{95})/i)![1].toUpperCase();
    const trusted = JSON.parse(REAL_LINKS).flatMap((l: { target: { sha256_cert_fingerprints: string[] } }) => l.target.sha256_cert_fingerprints);
    expect(trusted).toContain(fp);
    void cpSync;
  });
});
