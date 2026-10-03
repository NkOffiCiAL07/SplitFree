// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const dims = (file: string) => {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe("app icons match the declared sizes (regenerate with `npm run icons`)", () => {
  it.each([72, 96, 128, 144, 152, 192, 384, 512])("icon-%ix%i.png", (n) => {
    expect(dims(`public/icons/icon-${n}x${n}.png`)).toEqual([n, n]);
  });
  it("favicon and apple-touch icon", () => {
    expect(dims("public/icons/icon-32x32.png")).toEqual([32, 32]);
    expect(dims("public/apple-touch-icon.png")).toEqual([180, 180]);
  });
  it("every icon the web manifest lists exists", () => {
    const m = JSON.parse(readFileSync("public/manifest.json", "utf8")) as { icons: { src: string; sizes: string }[] };
    for (const i of m.icons) {
      const n = Number(i.sizes.split("x")[0]);
      expect(dims(`public${i.src}`)).toEqual([n, n]);
    }
  });
});
