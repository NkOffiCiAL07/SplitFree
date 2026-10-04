import { isNativeApp } from "@/lib/native";

export type SaveResult = "downloaded" | "shared" | "cancelled";

/**
 * The iPhone app's web view can't save a file the way a browser does (a download link silently does nothing),
 * so there the file goes to the iOS share sheet instead: "Save to Files", AirDrop, WhatsApp, Mail…
 */
async function shareFile(blob: Blob, filename: string, mime: string): Promise<SaveResult> {
  const file = new File([blob], filename, { type: mime });
  if (!navigator.canShare?.({ files: [file] })) throw new Error("This device can't save files from the app");
  try {
    await navigator.share({ files: [file], title: filename });
    return "shared";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "cancelled"; // they closed the share sheet
    throw e;
  }
}

/** Save the file served at `url` (same-origin, signed-in). Browsers: normal download. iPhone app: share sheet. */
export async function saveFileFromUrl(url: string, filename: string, mime: string): Promise<SaveResult> {
  if (!isNativeApp()) {
    window.location.href = url;
    return "downloaded";
  }
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Couldn't prepare the file — please try again");
  return shareFile(await res.blob(), filename, mime);
}

/** Save an in-memory file (e.g. a QR code image). Browsers: normal download. iPhone app: share sheet. */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  if (isNativeApp()) return shareFile(blob, filename, blob.type || "application/octet-stream");
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return "downloaded";
}
