#!/usr/bin/env node
/**
 * Publish a new Android APK:  npm run apk:update -- /path/to/SplitFree.apk
 *
 *  1. checks it really is a signed APK for com.splitfree.app,
 *  2. checks its signing key matches public/.well-known/assetlinks.json (if it doesn't, the installed app would show
 *     a browser address bar instead of running full-screen, and invite links wouldn't open in it),
 *  3. copies it to public/downloads/SplitFree.apk and rewrites the size + SHA-256 in src/lib/android-app.ts
 *     (the landing page shows them, and a test fails if they ever drift).
 * Then commit, push and deploy as usual.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [, , input, ...flags] = process.argv;
const force = flags.includes("--force");
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };

if (!input || !existsSync(input)) fail("Usage: npm run apk:update -- /path/to/SplitFree.apk");
const bytes = readFileSync(input);
if (bytes.subarray(0, 2).toString("latin1") !== "PK") fail("That file isn't an APK (not a zip archive).");
const text = bytes.toString("latin1");
for (const needle of ["AndroidManifest.xml", "classes.dex", "META-INF/"]) if (!text.includes(needle)) fail(`Not a complete signed APK: missing ${needle}`);
if (!text.includes("com.splitfree.app")) console.warn("⚠ Couldn't find the package name com.splitfree.app inside (it may be compressed) — double-check this is the right app.");

// 2. signing key vs assetlinks.json
const links = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
const allowed = links.flatMap((l) => l.target?.sha256_cert_fingerprints ?? []).map((f) => f.toUpperCase());
let fingerprint = null;
try {
  const out = execFileSync("keytool", ["-printcert", "-jarfile", input], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  fingerprint = out.match(/SHA256:\s*([0-9A-F:]{95})/i)?.[1]?.toUpperCase() ?? null;
} catch { /* keytool (JDK) not installed */ }
if (!fingerprint) {
  console.warn("⚠ Couldn't read the signing key (keytool not found). Install a JDK, or verify by hand that the APK is signed with the key listed in public/.well-known/assetlinks.json.");
} else if (!allowed.includes(fingerprint)) {
  console.error(`✗ This APK is signed with a DIFFERENT key:\n    ${fingerprint}\n  assetlinks.json only trusts:\n    ${allowed.join("\n    ")}`);
  console.error("  Installed as-is, the app would show a browser address bar and invite links wouldn't open in it, and people with the old app couldn't update.");
  console.error("  Sign with the same keystore, or add this fingerprint to public/.well-known/assetlinks.json first (keep the old one if the old app is still in use). Use --force to publish anyway.");
  if (!force) process.exit(1);
} else {
  console.log(`✓ Signing key matches assetlinks.json (${fingerprint.slice(0, 11)}…)`);
}

// 3. publish
const sha256 = createHash("sha256").update(bytes).digest("hex");
copyFileSync(input, "public/downloads/SplitFree.apk");
let ts = readFileSync("src/lib/android-app.ts", "utf8");
const next = ts
  .replace(/sizeBytes: \d+/, `sizeBytes: ${bytes.length}`)
  .replace(/sha256: "[0-9a-f]{64}"/, `sha256: "${sha256}"`);
if (next === ts && !ts.includes(sha256)) fail("Couldn't update src/lib/android-app.ts (unexpected format).");
writeFileSync("src/lib/android-app.ts", next);
console.log(`✓ Published ${(bytes.length / 1024 / 1024).toFixed(2)} MB  sha256 ${sha256}`);
console.log("Next: npm test, then commit, push and deploy.");
