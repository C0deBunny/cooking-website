// import lib
import { cacheTag } from "next/cache";
import { createPublicClient } from "../supabase/public-client";

// import types
import type { Recipes } from "@/types/recipes";

export async function getRecipes(): Promise<Recipes> {
  "use cache";

  cacheTag("recipes");

  const supabase = await createPublicClient();

  const { data, error } = await supabase.from("recipes").select("*");

  if (error) {
    throw new Error("Failed to fetch recipes: " + error.message);
  }

  return data ?? [];
}
