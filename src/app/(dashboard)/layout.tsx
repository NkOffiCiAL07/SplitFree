import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { CommandPalette } from "@/components/layout/command-palette";
import { DemoBanner } from "@/components/dashboard/demo-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
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
    </div>
  );
}
