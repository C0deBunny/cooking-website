// import lib
import { getRecipes } from "@/lib/recipes/queries";

// import components
import RecipeCard from "@/components/shared/RecipeCard";

export default async function Recipes() {
  const recipes = await getRecipes();

  return (
    <section className="w-full text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="w-full max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-center">Recipes</h1>
          {/* Search/filter/sort can become a separate client component later */}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.length > 0 ? (
            // The embed is filtered to the primary in the query, so this list holds at most one
            // entry per recipe and the card never has to pick (decision 36).
            recipes.map((recipe) => <RecipeCard key={recipe.id} slug={recipe.slug} title={recipe.title} description={recipe.description} cover={recipe.recipe_images[0]?.storage_path ?? null} />)
          ) : (
            <p className="text-muted-foreground">No recipes found.</p>
          )}
        </div>
      </div>
    </section>
  );
}
