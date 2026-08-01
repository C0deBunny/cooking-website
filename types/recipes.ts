// import types
import type { Database } from "@/types/database";

/**
 * Derived from the generated schema types rather than hand-written, so these can't
 * drift from the database. Regenerate with `npm run db:types` after every migration.
 */
export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type Recipes = Recipe[];

export type RecipeStep = Database["public"]["Tables"]["recipe_steps"]["Row"];
export type RecipeIngredient = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type RecipeImage = Database["public"]["Tables"]["recipe_images"]["Row"];

export type RecipeDifficulty = Database["public"]["Enums"]["recipe_difficulty"];

/**
 * A recipe with the children the detail page renders, matching the embedded select in
 * `getRecipeBySlug`. Composed from the aliases above rather than restated, so a column change
 * still surfaces here. Images are absent on purpose — no Storage bucket exists yet.
 */
export type RecipeWithChildren = Recipe & {
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
};
