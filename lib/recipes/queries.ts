// import lib
import { cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";
import { createClient } from "@/lib/supabase/server-client";

// import types
import type { Recipe, Recipes, RecipeWithChildren } from "@/types/recipes";

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
 * The manage page's list, and deliberately not getRecipes().
 *
 * getRecipes() is cached and therefore always anonymous, and RLS limits anon to published rows —
 * so reusing it here would render a management page with every draft silently missing. Nothing
 * would throw and nothing would log; the page would simply be wrong, and wrong about precisely
 * the rows it exists to manage. The cookie-backed client is the only one that is
 * `authenticated`, and it cannot be cached, because reading cookies inside "use cache" is
 * illegal in Next 16.
 */
export async function getRecipesForAdmin(): Promise<Recipes> {
  const supabase = await createClient();

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
 * Whether a slug already belongs to a recipe — the wizard's live check on the title field.
 *
 * **Not cached, and it must not become cached.** The entire value of this read is that it reflects
 * the table right now; a `"recipes"`-tagged entry would keep answering "free" for the rest of the
 * revalidate window after the address was taken, which is worse than not checking at all.
 *
 * Server client rather than the public one, for the same reason `getRecipesForAdmin` uses it: anon
 * sees only published rows under RLS, so a *draft* sitting on the slug would come back as free and
 * the save would then fail on a collision this function had just cleared.
 *
 * Not an availability check for editing. On edit, a recipe's own slug is "taken" — by itself — so
 * the edit path will need to exclude its own id rather than reuse this as-is.
 */
export async function isSlugTaken(slug: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("recipes").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error("Failed to check the recipe address: " + error.message);
  }

  return data !== null;
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
