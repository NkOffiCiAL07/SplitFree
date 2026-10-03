#!/usr/bin/env node
/**
 * App Store icon (1024×1024, NO transparency — Apple rejects alpha) and the launch image, from the brand mark:
 *   npm run ios:assets
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { brandMarkSvg } from "../src/lib/brand-mark.ts";

const dir = "ios/App/App/Assets.xcassets";

// App icon: full-bleed (the OS applies the rounded mask), flattened so there's no alpha channel
await sharp(Buffer.from(brandMarkSvg({ size: 1024, variant: "bleed" })), { density: 300 })
  .resize(1024, 1024).flatten({ background: "#6d28d9" }).png().toFile(`${dir}/AppIcon.appiconset/AppIcon-512@2x.png`);

// Launch image: brand gradient with the rounded mark centred (shown by LaunchScreen.storyboard, aspect-fill)
const S = 2732, tile = 560;
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d28d9"/><stop offset="0.55" stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
const mark = await sharp(Buffer.from(brandMarkSvg({ size: tile, variant: "rounded" })), { density: 300 }).resize(tile, tile).png().toBuffer();
const splash = await sharp(Buffer.from(bg)).composite([{ input: mark, left: (S - tile) / 2, top: (S - tile) / 2 }]).png().toBuffer();
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) writeFileSync(`${dir}/Splash.imageset/${f}`, splash);
console.log("✓ app icon (1024, no alpha) and launch image written");
