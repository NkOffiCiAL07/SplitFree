import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const native = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/native", () => ({ isNativeApp: () => native.on }));

import { saveFileFromUrl, saveBlob } from "@/lib/save-file";

const setNav = (nav: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(nav)) Object.defineProperty(navigator, k, { value: v, configurable: true });
};

beforeEach(() => { native.on = false; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setNav({ canShare: undefined, share: undefined }); });

describe("saveFileFromUrl", () => {
  it("in a browser it just navigates to the file (a normal download)", async () => {
    const loc = { href: "/settings" };
    vi.stubGlobal("location", loc);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveFileFromUrl("/api/export", "x.csv", "text/csv")).toBe("downloaded");
    expect(loc.href).toBe("/api/export");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in the iPhone app it fetches the file (signed in) and opens the share sheet with it", async () => {
    native.on = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a,b\n1,2", { status: 200 })));
    const share = vi.fn().mockResolvedValue(undefined);
    setNav({ canShare: () => true, share });
    expect(await saveFileFromUrl("/api/export", "splitr-expenses.csv", "text/csv")).toBe("shared");
    expect(fetch).toHaveBeenCalledWith("/api/export", { credentials: "same-origin" });
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0].name).toBe("splitr-expenses.csv");
    expect(arg.files[0].type).toBe("text/csv");
    expect(await arg.files[0].text()).toBe("a,b\n1,2");
  });

  it("closing the share sheet is not an error", async () => {
    native.on = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x")));
    setNav({ canShare: () => true, share: vi.fn().mockRejectedValue(Object.assign(new Error("cancel"), { name: "AbortError" })) });
    expect(await saveFileFromUrl("/api/export", "a.csv", "text/csv")).toBe("cancelled");
  });

  it("a failed fetch or a device that can't share files is reported, never silent", async () => {
    native.on = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 500 })));
    await expect(saveFileFromUrl("/api/export", "a.csv", "text/csv")).rejects.toThrow(/try again/i);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
    setNav({ canShare: () => false });
    await expect(saveFileFromUrl("/api/export", "a.csv", "text/csv")).rejects.toThrow(/can't save files/i);
  });
});

describe("saveBlob", () => {
  it("in the app shares the image; in a browser it clicks a download link", async () => {
    native.on = true;
    const share = vi.fn().mockResolvedValue(undefined);
    setNav({ canShare: () => true, share });
    expect(await saveBlob(new Blob(["png"], { type: "image/png" }), "qr.png")).toBe("shared");
    expect((share.mock.calls[0][0] as { files: File[] }).files[0].type).toBe("image/png");

    native.on = false;
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(await saveBlob(new Blob(["png"], { type: "image/png" }), "qr.png")).toBe("downloaded");
    expect(click).toHaveBeenCalled();
  });
});
