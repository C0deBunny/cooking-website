// import lib
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/lib/recipes/queries";

// import components
import RecipeArticle from "@/components/shared/RecipeArticle";
import { Skeleton } from "@/components/ui/skeleton";

// import types
import type { Metadata } from "next";

/**
 * The public recipe page — the first consumer `recipes.slug` has ever had.
 *
 * getRecipeBySlug is cached and therefore anonymous, so RLS limits this to published recipes:
 * an unpublished one 404s here even for the owner. /admin/preview/[slug] is how you look at a
 * draft.
 *
 * The Suspense boundary is load-bearing, not decoration. `params` is request data, and with
 * `cacheComponents: true` awaiting it in the page body blocks the whole route from
 * prerendering — the build fails outright rather than degrading. Keeping the await inside a
 * boundary lets the shell prerender while the recipe streams in. Same reasoning as the navbar's
 * getCurrentUser() calls; see CLAUDE.md.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) return { title: "Recipe not found" };

  return {
    title: recipe.title,
    description: recipe.description ?? undefined,
  };
}

async function RecipeContent({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) notFound();

  return <RecipeArticle recipe={recipe} />;
}

function RecipeFallback() {
  return (
    <div className="w-full">
      <div className="bg-foreground/5 w-full">
        <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
      <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-4/6" />
      </div>
    </div>
  );
}

export default function RecipePage({ params }: Props) {
  // Note this component is deliberately NOT async and does not touch `params` — it only hands
  // the promise down. Awaiting it here is what broke the build.
  return (
    <section className="w-full">
      <Suspense fallback={<RecipeFallback />}>
        <RecipeContent params={params} />
      </Suspense>
    </section>
  );
}
