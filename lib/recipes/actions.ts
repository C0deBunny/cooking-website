"use server";

// import lib
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server-client";
import { requireUser } from "@/lib/auth/queries";
import { recipeSchema, type RecipeFormState } from "@/lib/recipes/schema";

// Only async functions may be exported from a "use server" file — the schemas and the
// RecipeFormState type live in ./schema.ts for that reason.

/**
 * Saves a recipe and its children in one transaction.
 *
 * The whole recipe arrives as a single JSON field rather than as individual form fields: the
 * form holds ingredients and steps as arrays in client state, so serialising them once is
 * simpler than reassembling indexed field names, and the array that comes out is already the
 * jsonb the database function wants. Array position is the ordering at every stage.
 *
 * The write itself goes through save_recipe() because Supabase JS sends every statement as its
 * own transaction — replacing a recipe's children with a delete plus an insert would risk
 * leaving it with no steps if the second call failed.
 */
export async function saveRecipe(_prevState: RecipeFormState, formData: FormData): Promise<RecipeFormState> {
  // First, so an unauthenticated caller costs nothing. Not a substitute for RLS — the policies
  // on these tables are the real boundary — but it fails fast and keeps the redirect sensible.
  await requireUser();

  const raw = formData.get("payload");

  if (typeof raw !== "string") {
    return { error: "The form submitted nothing to save." };
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "The form data was malformed. Try reloading the page." };
  }

  const parsed = recipeSchema.safeParse(json);

  if (!parsed.success) {
    // Surface the first real message — the schema writes them for humans, so this is more use
    // than a generic failure. The rest are still visible in the form's own field validation.
    return { error: parsed.error.issues[0]?.message ?? "That recipe isn't valid yet." };
  }

  const supabase = await createClient();

  const { data: recipeId, error } = await supabase.rpc("save_recipe", { payload: parsed.data });

  if (error) {
    // 23505 is unique_violation, which here means the slug is taken — a routine collision worth
    // a readable message rather than a raw Postgres error.
    if (error.code === "23505") {
      return { error: `The slug "${parsed.data.slug}" is already used by another recipe.` };
    }

    return { error: "Failed to save the recipe: " + error.message };
  }

  if (!recipeId) {
    return { error: "The recipe was not saved. Check that you are still signed in." };
  }

  // updateTag, not revalidateTag: this is a form submission, so the value has to be fresh on
  // this same response for the preview below to show what was just written.
  updateTag("recipes");

  // The preview route rather than the public one, because it reads with the authenticated
  // client and therefore works whether or not the recipe was published.
  redirect(`/admin/preview/${parsed.data.slug}`);
}
