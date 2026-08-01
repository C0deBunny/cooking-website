// import lib
import { notFound } from "next/navigation";

// import components
import { SidebarProvider } from "@/components/ui/sidebar";
import DevNav from "./_components/DevNav";
import ButtonsSection from "./_components/ButtonsSection";
import FormsSection from "./_components/FormsSection";
import OverlaysSection from "./_components/OverlaysSection";
import DataSection from "./_components/DataSection";
import IconBrowser from "./_components/IconBrowser";

// import types
import type { Metadata } from "next";

// Kept on the page, not the layout: a layout-level title still resolves when the layout bails, so it
// would name this route on the production 404 page.
export const metadata: Metadata = {
  title: "Component gallery",
};

export default function DevPage() {
  // Repeats the layout's guard on purpose. The layout's notFound() only changes what is *displayed* —
  // the page still renders and its whole tree ends up in the 404's RSC payload. Bailing here too keeps
  // the gallery markup out of the production build's responses entirely.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    // The shell mirrors app/admin/layout.tsx: min-h-0 cancels SidebarProvider's own min-h-svh, which
    // would otherwise shove the footer a full viewport down, and the width override beats fighting
    // tailwind-merge over a w-* class on the rail. It lives in the page rather than the layout
    // because /dev is a single route — there is nothing for a layout to share.
    <SidebarProvider className="min-h-0" style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <DevNav />

      {/* min-w-0 so a wide specimen (DataSection's Table) shrinks the column instead of blowing the
          page out sideways — flex items default to min-width:auto, which refuses to go below content. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-foreground/5">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Component gallery</h1>
            <p className="mt-2 max-w-2xl text-foreground/60">
              Every shadcn primitive in this project, rendered against the real theme tokens and fonts. Dev-only — this route 404s in production. Use the navbar toggle to check both colour schemes.
            </p>
          </div>
        </div>

        {/* pt-12 replaces the top spacing DevNav's mb-10 used to provide, now that it has moved out. */}
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 pt-12 pb-24">
          <ButtonsSection />
          <FormsSection />
          <OverlaysSection />
          <DataSection />
          <IconBrowser />
        </div>
      </div>
    </SidebarProvider>
  );
}
