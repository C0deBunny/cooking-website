// import lib
import { cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";

// import types
import type { Recipe } from "@/types/recipes";

/**
 * The only place recipes are read. Cached and tagged, so createRecipe can invalidate it —
 * uses the public client because reading cookies inside "use cache" is illegal in Next 16.
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
