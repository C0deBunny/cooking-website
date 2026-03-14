"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Recipe } from "@/types/recipes";

export default function AddRecipeButton({ onRecipeAdded }: { onRecipeAdded: (recipe: Recipe) => void }) {
  async function addRecipe() {
    const { data, error } = await createClient
      .from("recipes")
      .insert([
        {
          title: "Apple Pie",
          description: "Delicious apple pie added from button",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Insert failed:", error);
    } else {
      console.log("Recipe inserted!");
    }

    onRecipeAdded(data);
  }

  return (
    <Button className="mt-4" onClick={addRecipe}>
      Add New Recipe
    </Button>
  );
}
