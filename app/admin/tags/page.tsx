// import components
import { Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder for a feature that is designed but unbuilt — see the Non-goals in
 * `docs/plans/recipe-schema-redesign/plan.md`, which parks tags as their own vertical (tables,
 * this page, and a selector in the create wizard). When that lands this file is replaced
 * wholesale; nothing here is meant to be extended.
 *
 * It reads no request data — no cookies, no params, no database — so the route stays
 * prerenderable under `cacheComponents` and needs no Suspense boundary. A tag count or a
 * "last updated" line would turn a trivial static page into a StaticGenBailoutError, so keep
 * the dullness.
 *
 * The band is copied from app/admin/manage/page.tsx rather than shared: two pages is not a
 * pattern yet, and the shell is four elements.
 *
 * `min-h-96` with `place-items-center` instead of claiming the region with flex-1: the version
 * this replaces centred itself in the viewport, which is what made it read as a floating orphan
 * rather than a page. Bounded, the block keeps the same distance below the band on any screen.
 *
 * Two deliberate deviations, both weighed and chosen:
 * - The tinted circle is a second empty-state idiom. The first is the dashed box in
 *   manage/_components/RecipeTable.tsx, and there is no rule saying which a new screen should
 *   use. Pick one before there is a third.
 * - `<Badge>` spends `primary` on a label you cannot act on, where the rest of the app uses it
 *   for actions and current position. The circle was kept neutral for exactly that reason —
 *   `bg-foreground/10`, not `bg-muted`, which at oklch(0.9702) is invisible against the 0.98
 *   background in light mode.
 */
export default function ManageTagsPage() {
  return (
    <section className="w-full flex-1 text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-bold">
            Manage Tags
            <Badge>Soon</Badge>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">The vocabulary recipes get filed under.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid min-h-96 place-items-center text-center">
          <div>
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-foreground/10 text-muted-foreground">
              <Tags className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Tags aren&apos;t built yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              When they land, this is where you&apos;ll create them, rename them, and see how many recipes use each one. Until then recipes have no tags to pick from.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
