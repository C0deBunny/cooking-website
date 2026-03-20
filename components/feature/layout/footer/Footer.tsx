// import Components
import Socials from "./Socials";
import Navigators from "./Navigators";
import { Suspense } from "react";
import CopyRights from "./CopyRights";

export default function Footer() {
  return (
    <footer className="mt-20 mb-10 border-t">
      <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-muted-foreground">
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
