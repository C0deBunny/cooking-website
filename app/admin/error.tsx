"use client";

// import components
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundaries must be client components — that is a framework rule, not a preference.
 *
 * Placed at app/admin/ so it renders *inside* the admin layout: a failed query replaces the
 * content region while the sidebar, navbar and footer stay put. Without any error.tsx the
 * nearest handler is Next's built-in one, which blanks the entire page and offers no way back.
 *
 * Two limits worth knowing before relying on this. It catches its sibling segments and below,
 * but not app/admin/layout.tsx itself — so an AdminGate failure still escapes, and closing that
 * gap needs a root app/error.tsx. And it cannot catch a server action: those reject at the call
 * site, which is why the manage page's mutations return `{ error }` and toast instead.
 *
 * The digest is shown because Next replaces a server error's real message with a generic string
 * in production. The digest is the only handle that ties what the user saw to a server log.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <div className="grid size-11 place-items-center rounded-lg bg-destructive/10">
          <TriangleAlert className="size-5 text-destructive" />
        </div>

        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This page couldn&apos;t load. It&apos;s usually temporary — try again, and if it keeps happening the code below identifies it in the server logs.
        </p>

        {error.digest && <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{error.digest}</code>}

        <Button onClick={reset} variant="outline" className="mt-1">
          <RotateCcw />
          Try again
        </Button>
      </div>
    </div>
  );
}
