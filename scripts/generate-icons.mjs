#!/usr/bin/env node
/**
 * Regenerates every app icon from the single brand mark (src/lib/brand-mark.ts):
 *   npm run icons
 * PWA / home-screen icons use the full-bleed variant (the OS rounds it; the coin sits in the maskable safe zone).
 * The 32px favicon uses the rounded tile. Rebuild the Android APK to pick up a new launcher icon.
 */
import sharp from "sharp";
import { brandMarkSvg } from "../src/lib/brand-mark.ts";

const bleed = [72, 96, 128, 144, 152, 192, 384, 512];
for (const size of bleed) {
  await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "bleed" })), { density: 300 }).resize(size, size).png().toFile(`public/icons/icon-${size}x${size}.png`);
}
await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "bleed" })), { density: 300 }).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "rounded" })), { density: 300 }).resize(32, 32).png().toFile("public/icons/icon-32x32.png");
console.log(`✓ wrote ${bleed.length} PWA icons, apple-touch-icon.png and the 32px favicon`);
