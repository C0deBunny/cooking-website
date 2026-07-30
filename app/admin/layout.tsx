// import lib
import { Suspense } from "react";

// import components
import AdminGate from "./_components/AdminGate";
import AdminSidebar from "./_components/AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

/**
 * One gate for everything under /admin. Put new owner-only routes below this segment rather
 * than repeating the check per page.
 *
 * The shell below the gate is a rail plus a content region.
 *
 * min-h-0 cancels SidebarProvider's own min-h-svh, which would otherwise push the footer a full
 * viewport down; flex-1 then makes the shell fill <main> instead. This depends on <main> being a
 * flex column — see app/layout.tsx. Without that it silently collapses to the height of the nav
 * buttons, because flex-1 on a block parent's child does nothing.
 *
 * The content region is a plain div rather than SidebarInset because that renders a <main>, and
 * <main> may not nest.
 */
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminGate />
      </Suspense>

      <SidebarProvider className="min-h-0 flex-1">
        <AdminSidebar />

        {/* flex column so a page can claim the region's height with flex-1 rather than a percentage */}
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarProvider>
    </>
  );
}
