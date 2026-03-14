// import lib
import { supabase } from "@/lib/supabase/client";

// import components
import RecipeCard from "@/components/Atoms/test";
import AddRecipeButton from "@/components/Atoms/AddRecipeButton";

//import types
import { Recipes } from "@/types/recipes";

export default async function Home() {
  const { data, error } = await supabase.from("recipes").select("*");

  const recipes: Recipes = data ?? [];

  if (error) {
    console.error("Error fetching recipes:", error);
    return <div className="p-8">Failed to load recipes.</div>;
  }

  return (
    <div className="p-8">
      {recipes?.map((recipe) => (
        <RecipeCard key={recipe.id} title={recipe.title} description={recipe.description} />
      ))}
      <AddRecipeButton />
    </div>
  );
}
