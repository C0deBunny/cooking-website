"use client";

// import lib
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

// import components
import RecipeCard from "@/components/shared/RecipeCard";

// import types
import type { Recipes } from "@/types/recipes";

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipes>([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      const { data, error } = await createClient().from("recipes").select("*");

      if (error) {
        console.error("Error fetching recipes:", error);
        return;
      }

      if (data) {
        setRecipes(data);
      }
    };

    fetchRecipes();
  }, []);

  return (
    <section className="w-full  text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="w-full max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-4 text-center">Recipes</h1>
          {/* TODO Search functionality with filter and sort */}
        </div>
      </div>
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        {/* Recipe cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.length > 0 ? recipes.map((recipe) => <RecipeCard key={recipe.id} title={recipe.title} description={recipe.description} />) : <p className="text-gray-500">No recipes found.</p>}
        </div>
      </div>
    </section>
  );
}
