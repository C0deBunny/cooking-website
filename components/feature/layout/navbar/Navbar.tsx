// import components
import { ThemeToggle } from "./theme/Theme-toggle";
import { Suspense } from "react";
import { User } from "lucide-react";
import Navigators from "./Navigators";
import NavbarAuthSlot from "./NavbarAuthSlot";

/**
 * The site header, sticky on every route.
 *
 * h-16 is a fixed height rather than padding-derived, and that is load-bearing twice over. First,
 * Navigators sits behind Suspense with a 16px-tall fallback, so a content-sized header would stream
 * in short and jump to 65px once getCurrentUser() resolves — visible on first paint the moment
 * anything is offset from it. Second, three things now measure from this number: the /admin rail's
 * sticky offset, the /dev rail's, and scroll-mt on /dev's anchor targets. Change it and grep top-16.
 *
 * Preflight makes everything border-box, so h-16 is 64px including border-b — the inner row uses
 * h-full instead of py-3 because once the height is pinned, padding is the wrong lever.
 *
 * z-40 is above page content and below the overlay layer: dialog, sheet and alert-dialog are all
 * z-50, so modals still cover the header. Keep it in that gap.
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Suspense fallback={<div className="h-4 w-32 rounded bg-muted" />}>
          <Navigators />
        </Suspense>

        <div className="flex items-center gap-1 pr-1">
          <ThemeToggle />
          <Suspense fallback={<User className="h-4 w-4" />}>
            <NavbarAuthSlot />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
