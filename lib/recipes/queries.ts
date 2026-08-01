// import lib
import { cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";
import { createClient } from "@/lib/supabase/server-client";

// import types
import type { Recipe, RecipeWithChildren } from "@/types/recipes";

/** The children the detail page renders, ordered by their ordering columns rather than by luck. */
const RECIPE_WITH_CHILDREN = "*, recipe_ingredients(*), recipe_steps(*)";

/**
 * The recipe list. Cached and tagged, so saveRecipe can invalidate it — uses the public client
 * because reading cookies inside "use cache" is illegal in Next 16.
 *
 * Note there is no `.eq("published", true)`: RLS is what hides drafts from visitors. Don't
 * "fix" that by adding a filter, and don't read the absence of one as a way to see drafts.
 */
export async function getRecipes(): Promise<Recipe[]> {
  "use cache";

  cacheTag("recipes");

  const supabase = createPublicClient();

  const { data, error } = await supabase.from("recipes").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to fetch recipes: " + error.message);
  }

  return data ?? [];
}

/**
 * One recipe for the public detail page, with its ingredients and steps.
 *
 * Cached, so it goes through the public client and is therefore always anonymous — which means
 * RLS limits it to published recipes. An unpublished recipe returns null here even for the
 * owner; that is what getDraftBySlug exists for.
 *
 * The cache tag is the broad "recipes" rather than a per-slug one on purpose. The broad tag is
 * needed anyway, and it is what makes a slug rename correct: the old slug's entry has to die or
 * that URL keeps serving the old recipe until the revalidate window lapses.
 */
export async function getRecipeBySlug(slug: string): Promise<RecipeWithChildren | null> {
  "use cache";

  cacheTag("recipes");

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_CHILDREN)
    .eq("slug", slug)
    .order("sort_order", { referencedTable: "recipe_ingredients" })
    .order("step_number", { referencedTable: "recipe_steps" })
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch recipe: " + error.message);
  }

  return data;
}

/**
 * The same read for the admin preview, and deliberately a separate function rather than a flag
 * on the one above.
 *
 * Uses the cookie-backed server client, so the request is `authenticated` and RLS allows drafts.
 * That makes it uncacheable — cookies inside "use cache" are illegal — which is also why the
 * public page can't just fall back to it: deciding on the basis of a cookie would make
 * /recipes/[slug] dynamic for every visitor, to serve a preview used twice a month.
 */
export async function getDraftBySlug(slug: string): Promise<RecipeWithChildren | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_CHILDREN)
    .eq("slug", slug)
    .order("sort_order", { referencedTable: "recipe_ingredients" })
    .order("step_number", { referencedTable: "recipe_steps" })
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch recipe: " + error.message);
  }

  return data;
}
