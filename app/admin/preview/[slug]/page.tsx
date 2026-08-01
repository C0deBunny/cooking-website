// import lib
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDraftBySlug } from "@/lib/recipes/queries";

// import components
import RecipeArticle from "@/components/shared/RecipeArticle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The owner's view of a recipe, published or not.
 *
 * This exists because the public page cannot show a draft: it reads through the cached, and
 * therefore anonymous, public client, and RLS gives `anon` published recipes only. Reading with
 * the cookie-backed client here is what makes drafts visible — and is also why nothing on this
 * route can be cached.
 *
 * Under /admin, so app/admin/layout.tsx's AdminGate already covers it. No per-page check needed.
 *
 * Everything request-scoped sits inside the Suspense boundary below. `export const dynamic` would
 * express the intent more directly but is rejected outright under `cacheComponents`, so the
 * boundary is the only mechanism available.
 */

type Props = { params: Promise<{ slug: string }> };

async function PreviewContent({ params }: Props) {
  const { slug } = await params;
  const recipe = await getDraftBySlug(slug);

  if (!recipe) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-foreground/5 px-6 py-4">
        <Badge variant={recipe.published ? "default" : "secondary"}>{recipe.published ? "Published" : "Draft"}</Badge>

        <p className="text-sm text-muted-foreground">{recipe.published ? "This is live on the site." : "Only you can see this. It won't appear on /recipes until it's published."}</p>

        <div className="ml-auto flex gap-2">
          {recipe.published ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/recipes/${recipe.slug}`}>View public page</Link>
            </Button>
          ) : null}

          <Button asChild variant="outline" size="sm">
            <Link href="/admin/create">New recipe</Link>
          </Button>
        </div>
      </div>

      <RecipeArticle recipe={recipe} />
    </>
  );
}

function PreviewFallback() {
  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-5/6" />
    </div>
  );
}

export default function PreviewRecipePage({ params }: Props) {
  // Not async, and does not touch `params` — it only passes the promise down.
  return (
    <div className="w-full">
      <Suspense fallback={<PreviewFallback />}>
        <PreviewContent params={params} />
      </Suspense>
    </div>
  );
}
