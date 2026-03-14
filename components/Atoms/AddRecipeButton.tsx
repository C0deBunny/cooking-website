"use client";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AddRecipeButton() {
  async function addRecipe() {
    const { error } = await supabase.from("recipes").insert([
      {
        title: "Apple Pie",
        description: "Delicious apple pie added from button",
      },
    ]);

    if (error) {
      console.error("Insert failed:", error);
    } else {
      console.log("Recipe inserted!");
      location.reload(); // quick way to refresh data
    }
  }

  return (
    <Button className="mt-4" onClick={addRecipe}>
      Add New Recipe
    </Button>
  );
}
