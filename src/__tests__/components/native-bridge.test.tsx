import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  native: false, pathname: "/dashboard", push: vi.fn(),
  listener: null as null | ((e: { url: string }) => void), removed: vi.fn(),
  hide: vi.fn(), setStyle: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => h.native, getPlatform: () => (h.native ? "ios" : "web") } }));
vi.mock("next/navigation", () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: h.push }) }));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: (o: unknown) => { h.hide(o); return Promise.resolve(); } } }));
vi.mock("@capacitor/status-bar", () => ({ StatusBar: { setStyle: (o: unknown) => { h.setStyle(o); return Promise.resolve(); } }, Style: { Dark: "DARK", Default: "DEFAULT" } }));
vi.mock("@capacitor/app", () => ({
  App: { addListener: (_e: string, cb: (e: { url: string }) => void) => { h.listener = cb; return Promise.resolve({ remove: h.removed }); } },
}));

import { NativeBridge } from "@/components/shared/native-bridge";

beforeEach(() => { vi.clearAllMocks(); h.native = false; h.pathname = "/dashboard"; h.listener = null; document.documentElement.className = ""; delete document.documentElement.dataset.native; });
afterEach(() => vi.restoreAllMocks());

describe("NativeBridge in a normal browser", () => {
  it("does nothing at all", () => {
    render(<NativeBridge />);
    expect(h.hide).not.toHaveBeenCalled();
    expect(h.setStyle).not.toHaveBeenCalled();
    expect(h.listener).toBeNull();
    expect(document.documentElement.dataset.native).toBeUndefined();
  });
});

describe("NativeBridge in the iPhone app", () => {
  beforeEach(() => { h.native = true; });

  it("marks the page as native, and hides the launch image once the page is ready", () => {
    render(<NativeBridge />);
    expect(document.documentElement.dataset.native).toBe("ios");
    expect(document.documentElement).toHaveClass("native-app");
    expect(h.hide).toHaveBeenCalledWith({ fadeOutDuration: 250 });
  });

  it("status bar text is white on the purple sign-in screens and automatic elsewhere, following navigation", () => {
    const { rerender } = render(<NativeBridge />);
    expect(h.setStyle).toHaveBeenLastCalledWith({ style: "DEFAULT" });
    h.pathname = "/login"; rerender(<NativeBridge />);
    expect(h.setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
    h.pathname = "/groups"; rerender(<NativeBridge />);
    expect(h.setStyle).toHaveBeenLastCalledWith({ style: "DEFAULT" });
  });

  it("opens invite/universal links inside the app (splitrpro:// too), and ignores other sites", () => {
    render(<NativeBridge />);
    act(() => h.listener!({ url: `${window.location.origin}/join/abc123` }));
    expect(h.push).toHaveBeenCalledWith("/join/abc123");
    act(() => h.listener!({ url: "splitrpro://settle" }));
    expect(h.push).toHaveBeenLastCalledWith("/settle");
    h.push.mockClear();
    act(() => h.listener!({ url: "https://evil.example.com/join/abc" }));
    expect(h.push).not.toHaveBeenCalled();
  });

  it("stops listening for links when it unmounts", async () => {
    const { unmount } = render(<NativeBridge />);
    unmount();
    await Promise.resolve();
    expect(h.removed).toHaveBeenCalled();
  });
});
