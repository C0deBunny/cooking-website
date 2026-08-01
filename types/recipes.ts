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

/**
 * What `RecipeArticle` renders — deliberately narrower than a row, so a recipe that has never
 * been saved can be rendered without inventing the parts a row would have.
 *
 * The wizard's live preview is the reason. A draft has no `id` on its ingredients and no
 * `step_number` on its steps, and the alternative was an adapter that fabricated both: a
 * fake-row constructor whose only consumer is a preview, needing an update every time a column
 * is added to `recipe_ingredients` or `recipe_steps`. Narrowing the component's prop instead
 * means real rows satisfy this structurally and the two database-backed pages keep working
 * through `toRecipeView()`.
 *
 * `Pick` rather than restated fields, for the same reason the aliases above are derived: a
 * hand-written `description: string` once disagreed with a column that was always nullable.
 * This stays a *view* — a subset chosen by what the article shows — while its nullability comes
 * from the schema and cannot drift from it.
 */
export type RecipeView = Pick<Recipe, "title" | "description" | "difficulty" | "prep_minutes" | "cook_minutes" | "servings" | "notes"> & {
  ingredients: Pick<RecipeIngredient, "name" | "amount" | "unit">[];
  steps: Pick<RecipeStep, "instruction" | "note">[];
};
