import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/icons");

// SplitFree icon: violet gradient background + white lightning bolt (Zap)
// SVG rendered at 512×512, then downscaled to each size
const svgIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>

  <!-- Rounded square background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" ry="${size * 0.22}" fill="url(#bg)"/>

  <!-- Subtle shine overlay -->
  <rect width="${size}" height="${size * 0.55}" rx="${size * 0.22}" ry="${size * 0.22}" fill="url(#shine)"/>

  <!-- White Zap / lightning bolt centered -->
  <g transform="translate(${size * 0.5}, ${size * 0.5})">
    <!-- Zap icon path scaled to ~52% of icon size -->
    <path
      d="M ${-size * 0.07} ${-size * 0.27}
         L ${-size * 0.21} ${size * 0.04}
         L ${-size * 0.01} ${size * 0.04}
         L ${-size * 0.07} ${size * 0.27}
         L ${size * 0.21} ${-size * 0.04}
         L ${size * 0.02} ${-size * 0.04}
         Z"
      fill="white"
      opacity="0.97"
    />
  </g>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  for (const size of sizes) {
    const svg = Buffer.from(svgIcon(size));
    const outPath = join(outDir, `icon-${size}x${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Also generate a favicon-style 32×32 for good measure
  const svg32 = Buffer.from(svgIcon(32));
  await sharp(svg32).png().toFile(join(outDir, "icon-32x32.png"));
  console.log("✓ icon-32x32.png");

  console.log("\nAll icons generated in public/icons/");
}

generate().catch(console.error);
