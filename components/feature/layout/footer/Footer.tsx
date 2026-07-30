// import Components
import Socials from "./Socials";
import Navigators from "./Navigators";
import { Suspense } from "react";
import CopyRights from "./CopyRights";

// Spacing stays inside the border. As margin it sat outside, which drew the divider 80px below the
// content it was meant to separate and left bare page background under the footer.
export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Suspense fallback={<div className="h-4 w-32 rounded bg-muted" />}>
            <Navigators />
          </Suspense>

          <Socials />

          <Suspense fallback={<div className="h-4 w-32 rounded bg-muted" />}>
            <CopyRights />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
