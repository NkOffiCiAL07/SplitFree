import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { CommandPalette } from "@/components/layout/command-palette";
import { OfflineStatus } from "@/components/layout/offline-status";
import { InstallBanner } from "@/components/layout/install-banner";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { GlobalAddExpenseDialog } from "@/components/expenses/global-add-expense-dialog";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="safe-top flex flex-1 flex-col min-w-0 overflow-hidden">
        <OfflineStatus />
        <InstallBanner />
        <DemoBanner />
        <TopNav />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Mobile slide-in drawer */}
      <MobileDrawer />

      {/* Global command palette */}
      <CommandPalette />

      {/* Global add expense dialog (opened from mobile FAB / command palette) */}
      <GlobalAddExpenseDialog />
    </div>
  );
}
