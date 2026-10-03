/**
 * iOS shows a blank (white/black) screen while a home-screen app launches unless a launch image matching the device
 * is supplied. Sizes below cover current iPhones; each is generated on demand by /api/splash (see the route).
 * `w`/`h` are CSS points, `dpr` the pixel ratio.
 */
export const IPHONE_SPLASH_SIZES = [
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 430, h: 932, dpr: 3 }, // 15 Pro Max / 15 Plus / 14 Pro Max / 16 Plus
  { w: 393, h: 852, dpr: 3 }, // 15 / 15 Pro / 14 Pro / 16
  { w: 390, h: 844, dpr: 3 }, // 14 / 13 / 13 Pro / 12
  { w: 428, h: 926, dpr: 3 }, // 14 Plus / 13 Pro Max / 12 Pro Max
  { w: 375, h: 812, dpr: 3 }, // X / XS / 11 Pro / 13 mini
  { w: 414, h: 896, dpr: 3 }, // XS Max / 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR / 11
  { w: 414, h: 736, dpr: 3 }, // 6/7/8 Plus
  { w: 375, h: 667, dpr: 2 }, // 6/7/8 / SE 2 / SE 3
  { w: 320, h: 568, dpr: 2 }, // SE 1
] as const;

export const splashUrl = (w: number, h: number) => `/api/splash?w=${w}&h=${h}`;

/** Entries for Next's `appleWebApp.startupImage`. */
export function iosStartupImages() {
  return IPHONE_SPLASH_SIZES.map(({ w, h, dpr }) => ({
    url: splashUrl(w * dpr, h * dpr),
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
  }));
}

/** Largest/smallest image we're willing to render (guards the endpoint against abuse). */
export const SPLASH_MIN = 300;
export const SPLASH_MAX = 3000;
