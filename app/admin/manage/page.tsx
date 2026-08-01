// import lib
import { Suspense } from "react";

// import components
import Link from "next/link";
import { Plus } from "lucide-react";
import RecipeTableSection from "./_components/RecipeTableSection";
import TableSkeleton from "./_components/TableSkeleton";
import { Button } from "@/components/ui/button";

/**
 * The header band is static and flushes immediately; only the table waits on the read. That
 * split is required rather than cosmetic — the read is cookie-backed, and under
 * `cacheComponents: true` awaiting it here would fail the build. See RecipeTableSection.
 *
 * The recipe count deliberately isn't in the band: it would need the data, which would drag the
 * band behind the boundary too. It sits in the controls strip instead, directly above the table
 * it describes.
 */
export default function ManageRecipesPage() {
  return (
    <section className="w-full flex-1 text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-6 py-12">
          <div>
            <h1 className="text-4xl font-bold">Manage Recipes</h1>
            <p className="mt-2 text-sm text-muted-foreground">Every recipe, drafts included.</p>
          </div>

          <Button asChild size="lg">
            <Link href="/admin/create">
              <Plus />
              New recipe
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <Suspense fallback={<TableSkeleton />}>
          <RecipeTableSection />
        </Suspense>
      </div>
    </section>
  );
}
