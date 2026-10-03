/**
 * The Android app (a signed Trusted Web Activity wrapper around the web app), served from /public.
 * `sizeBytes` and `sha256` describe the exact file in public/downloads — a test fails if they drift, so the
 * checksum shown on the landing page always matches what people actually download.
 */
export const ANDROID_APP = {
  path: "/downloads/SplitFree.apk",
  fileName: "SplitFree.apk",
  packageName: "com.splitfree.app",
  sizeBytes: 1204797,
  sha256: "dfb828d10ef65cef8844e9d3ceeb79fbbeb87b5ee26b7e762785a475fa7c1490",
} as const;

export const androidSizeLabel = `${(ANDROID_APP.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
