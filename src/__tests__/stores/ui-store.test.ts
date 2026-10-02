import { describe, it, expect, beforeEach, vi } from "vitest";

// Node's experimental built-in localStorage is unusable without a flag; zustand's persist needs a real one.
vi.hoisted(() => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
});

import { useUIStore } from "@/stores/ui-store";

const initial = useUIStore.getState();
beforeEach(() => { useUIStore.setState(initial, true); localStorage.clear(); });

describe("ui-store", () => {
  it("starts with the sidebar open and every dialog closed", () => {
    const s = useUIStore.getState();
    expect([s.sidebarOpen, s.commandPaletteOpen, s.mobileMenuOpen, s.addExpenseOpen]).toEqual([true, false, false, false]);
  });

  it("sets and toggles each flag independently", () => {
    const s = useUIStore.getState();
    s.setCommandPaletteOpen(true);
    s.setAddExpenseOpen(true);
    s.setMobileMenuOpen(true);
    s.setSidebarOpen(false);
    expect(useUIStore.getState()).toMatchObject({ commandPaletteOpen: true, addExpenseOpen: true, mobileMenuOpen: true, sidebarOpen: false });
    useUIStore.getState().toggleSidebar();
    useUIStore.getState().toggleMobileMenu();
    expect(useUIStore.getState()).toMatchObject({ sidebarOpen: true, mobileMenuOpen: false });
  });

  it("only remembers the sidebar across reloads — dialogs never reopen themselves", () => {
    const s = useUIStore.getState();
    s.setSidebarOpen(false);
    s.setAddExpenseOpen(true);
    s.setCommandPaletteOpen(true);
    const saved = JSON.parse(localStorage.getItem("splitfree-ui")!);
    expect(saved.state).toEqual({ sidebarOpen: false });
  });
});
