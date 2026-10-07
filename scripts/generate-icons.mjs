#!/usr/bin/env node
/**
 * Regenerates every app icon from the single brand mark (src/lib/brand-mark.ts):
 *   npm run icons
 * PWA / home-screen icons use the full-bleed variant (the OS rounds it; the coin sits in the maskable safe zone).
 * The 32px favicon uses the rounded tile. Rebuild the Android APK to pick up a new launcher icon.
 */
import sharp from "sharp";
import { brandMarkSvg, MARK } from "../src/lib/brand-mark.ts";

const bleed = [72, 96, 128, 144, 152, 192, 384, 512];
for (const size of bleed) {
  await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "bleed" })), { density: 300 }).resize(size, size).png().toFile(`public/icons/icon-${size}x${size}.png`);
}
await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "bleed" })), { density: 300 }).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "rounded" })), { density: 300 }).resize(32, 32).png().toFile("public/icons/icon-32x32.png");
// Rounded tile with transparent corners: the Android splash screen shows this one (the full-bleed square would look like a hard-edged box)
await sharp(Buffer.from(brandMarkSvg({ size: 512, variant: "rounded" })), { density: 300 }).resize(512, 512).png().toFile("public/icons/icon-rounded-512x512.png");
// Android "themed icon": one flat shape on transparent, which Android recolours to match the wallpaper (kept inside the 66% safe zone)
const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48"><g transform="translate(24 24) scale(1.35) translate(-24 -24)"><path d="${MARK.halfA}" fill="#000"/><path d="${MARK.halfB}" fill="#000" transform="translate(${MARK.gap} ${MARK.gap})"/></g></svg>`;
await sharp(Buffer.from(mono), { density: 300 }).resize(512, 512).png().toFile("public/icons/icon-monochrome-512x512.png");
console.log(`✓ wrote ${bleed.length} PWA icons, apple-touch-icon.png and the 32px favicon and the 512px monochrome (themed) Android icon`);
