"use server";

// import lib
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server-client";
import { requireUser } from "@/lib/auth/queries";
import { createRecipeSchema, type CreateRecipeState } from "@/lib/recipes/schema";

export async function createRecipe(_prevState: CreateRecipeState, formData: FormData): Promise<CreateRecipeState> {
  // RLS would reject an anonymous insert anyway; this makes the intent explicit and keeps the
  // failure a redirect rather than a generic error.
  await requireUser();

  const parsed = createRecipeSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: "Please fill in both a title and a description." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("recipes").insert(parsed.data);

  if (error) {
    return { error: "Failed to create recipe." };
  }

  // The whole point of routing the write through the server: /recipes and /admin both read
  // getRecipes(), so invalidating the tag makes the new recipe visible immediately.
  //
  // updateTag, not revalidateTag — it is server-action-only and gives read-your-own-writes, so
  // the owner sees the recipe on this response. revalidateTag(tag, profile) only marks entries
  // stale for a later background refresh, which is not what a just-submitted form needs.
  updateTag("recipes");

  return { ok: true };
}
