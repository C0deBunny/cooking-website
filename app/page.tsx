"use client";

// import lib
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

// import components
import RecipeCard from "@/components/Atoms/RecipeCard";
import AddRecipeButton from "@/components/Atoms/AddRecipeButton";

//import types
import { Recipe, Recipes } from "@/types/recipes";

export default function Home() {
  const [recipes, setRecipes] = useState<Recipes>([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      const { data, error } = await supabase.from("recipes").select("*");

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

  function handleRecipeAdded(newRecipe: Recipe) {
    setRecipes((prev) => [...prev, newRecipe]);
  }

  return (
    <div className="p-8">
      {recipes?.map((recipe) => (
        <RecipeCard key={recipe.id} title={recipe.title} description={recipe.description} />
      ))}
      <AddRecipeButton onRecipeAdded={handleRecipeAdded} />
    </div>
  );
}
