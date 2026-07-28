import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  mobileMenuOpen: boolean;
  addExpenseOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setAddExpenseOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      commandPaletteOpen: false,
      mobileMenuOpen: false,
      addExpenseOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      setAddExpenseOpen: (open) => set({ addExpenseOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
    }),
    {
      name: "splitfree-ui",
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
