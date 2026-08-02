// import lib
import { Suspense } from "react";

// import components
import AdminGate from "./_components/AdminGate";
import AdminSidebar from "./_components/AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * One gate for everything under /admin. Put new owner-only routes below this segment rather
 * than repeating the check per page.
 *
 * Toaster and TooltipProvider are mounted here rather than in the root layout because /admin is
 * the only surface that uses them — the rest of the site is read-only. Neither works without
 * being mounted: a Tooltip without a provider throws, and toast() without a Toaster silently
 * does nothing. Until now both existed only in app/dev/layout.tsx.
 *
 * min-h-0 cancels SidebarProvider's own min-h-svh, which would otherwise push the footer a full
 * viewport down. Nothing here has to claim the height: <main> is a single-1fr-row grid, so this
 * shell is stretched to fill it — see app/layout.tsx.
 *
 * The content region is a plain div rather than SidebarInset because that renders a <main>, and
 * <main> may not nest. It is also where Toaster is mounted — see the note there before hoisting it.
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
        {/* AdminSidebar calls usePathname() to mark the active row. On a static route the pathname
            is known at build time, but on a dynamic one (/admin/preview/[slug]) it is request data
            — and with cacheComponents that fails the build unless it sits behind a boundary. The
            fallback reserves the rail's width so the content doesn't jump when it resolves. */}
        <Suspense fallback={<div className="w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar" />}>
          <AdminSidebar />
        </Suspense>

        {/* flex column so a page can claim the region's height with flex-1 rather than a percentage */}
        <div className="flex flex-1 flex-col">
          <TooltipProvider>{children}</TooltipProvider>

          {/* Mounted inside the shell, not as a sibling of it. sonner's <Toaster> renders an in-flow
              <section> — only the <ol> inside it is position: fixed — so at the top level it became a
              second grid item in <main>'s single 1fr row, took all the free height, and pushed this
              whole shell into an implicit auto row below it. Here it is a zero-height flex child and
              costs nothing. */}
          <Toaster />
        </div>
      </SidebarProvider>
    </>
  );
}
