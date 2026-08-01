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
 * min-h-0 cancels SidebarProvider's own min-h-svh, which would otherwise push the footer a full
 * viewport down. Nothing here has to claim the height: <main> is a single-1fr-row grid, so this
 * shell is stretched to fill it — see app/layout.tsx.
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

      {/* SidebarProvider spreads ...style after its own defaults, so overriding the width
          here beats fighting tailwind-merge over a w-* class on the rail itself. */}
      <SidebarProvider className="min-h-0" style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
        <AdminSidebar />

        {/* flex column so a page can claim the region's height with flex-1 rather than a percentage */}
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarProvider>
    </>
  );
}
