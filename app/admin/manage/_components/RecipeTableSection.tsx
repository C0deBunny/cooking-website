// import lib
import { getRecipesForAdmin } from "@/lib/recipes/queries";

// import components
import RecipeTable from "./RecipeTable";

/**
 * Exists only to hold the read.
 *
 * getRecipesForAdmin() is cookie-backed, and with `cacheComponents: true` awaiting request data
 * in the page body blocks the whole route from prerendering — the build fails with
 * StaticGenBailoutError rather than degrading. Keeping the await in a component below the page's
 * Suspense boundary is the mechanism; there is no route-level opt-out.
 */
export default async function RecipeTableSection() {
  const recipes = await getRecipesForAdmin();

  return <RecipeTable recipes={recipes} />;
}
