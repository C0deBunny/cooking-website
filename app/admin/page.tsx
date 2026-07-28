// import lib
import { getRecipes } from "@/lib/recipes/queries";

// import components
import RecipeCard from "@/components/shared/RecipeCard";
import NewRecipeDialog from "./_components/NewRecipeDialog";

export default async function AdminPage() {
  const recipes = await getRecipes();

  return (
    <section className="w-full text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="w-full max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl font-bold">Recipes</h1>

            <NewRecipeDialog />
          </div>

          {/* TODO Search functionality with filter and sort */}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.length > 0 ? (
            recipes.map((recipe) => <RecipeCard key={recipe.id} title={recipe.title} description={recipe.description} />)
          ) : (
            <p className="text-muted-foreground">No recipes found.</p>
          )}
        </div>
      </div>
    </section>
  );
}
