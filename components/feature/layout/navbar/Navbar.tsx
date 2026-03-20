// import components
import { ThemeToggle } from "./theme/Theme-toggle";
import { Suspense } from "react";
import { User } from "lucide-react";
import Navigators from "./Navigators";
import NavbarAuthSlot from "./NavbarAuthSlot";

export default function Navbar() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
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
