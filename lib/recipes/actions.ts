"use server";

// import lib
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server-client";
import { IMAGE_BUCKET } from "@/lib/supabase/storage";
import { getCurrentUser, requireUser } from "@/lib/auth/queries";
import { isSlugTaken } from "@/lib/recipes/queries";
import { detailsSchema, publishToggleSchema, recipeIdSchema, recipeSchema, slugTakenMessage, type RecipeFormState, type RecipeMutationState } from "@/lib/recipes/schema";

// Only async functions may be exported from a "use server" file — the schemas and the
// RecipeFormState type live in ./schema.ts for that reason.

/**
 * The wizard's live "is this address free?" check, called from the title field as it is typed.
 *
 * A read behind `"use server"`, which the reads in `queries.ts` deliberately are not. The rule
 * they follow is about server-component reads, where `"use server"` would expose an endpoint for
 * nothing and defeat `cache()`; this one has to be callable from a client component, and an action
 * is the mechanism for that. The query itself still lives in `queries.ts` with the other reads —
 * this is only the boundary.
 *
 * **Every failure answers `false`.** Signed out, a slug that isn't one, the query throwing — all of
 * that means "don't know", and "don't know" must never disable the Save button: it would lock the
 * user out of saving on a condition they can neither see nor clear. The unique index and the 23505
 * branch below are what actually enforce uniqueness. This only saves a wasted trip through Review.
 */
export async function checkSlugTaken(slug: string): Promise<boolean> {
  // getCurrentUser, not requireUser: this runs on a keystroke, and requireUser redirects — an
  // expired session would throw the user out of a half-filled wizard from a background poll.
  // Answering "free" to a signed-out caller is also what keeps draft addresses unprobeable.
  const user = await getCurrentUser();

  if (!user) return false;

  // A server action is a public endpoint, so the argument is validated like any other. Reusing
  // the schema's own slug rule rather than restating it keeps the two from drifting apart.
  const parsed = detailsSchema.shape.slug.safeParse(slug);

  if (!parsed.success) return false;

  try {
    return await isSlugTaken(parsed.data);
  } catch {
    return false;
  }
}

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
    // 23505 is unique_violation, which here means the slug is taken. Returned with the slug
    // itself so the form can point at the title that produced it — there is no slug field to
    // correct, by design.
    //
    // Still reachable with checkSlugTaken in front of it, and not only through the obvious race:
    // the check answers "free" whenever it could not find out. This branch is the enforcement,
    // that one is the courtesy — don't delete it on the grounds that the form now checks first.
    //
    // Narrowed to the slug constraint **by name**, which is a string match against a message
    // Postgres generates — fragile, and the alternative is worse. Five unique constraints are
    // reachable through save_recipe(), not one: recipes_slug_key, the two child ordering
    // constraints (which `with ordinality` makes unreachable), recipe_images (recipe_id,
    // storage_path) and the partial recipe_images_one_primary_idx. All raise 23505. Matching the
    // code alone reports an image bug as a title problem — unreachable today, since toPayload()
    // sends at most one image, and live the moment a gallery exists (decision 35).
    if (error.code === "23505" && error.message.includes("recipes_slug_key")) {
      return { error: slugTakenMessage(parsed.data.slug), takenSlug: parsed.data.slug };
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

/**
 * Publishes or unpublishes one recipe, from the manage page.
 *
 * Takes arguments rather than FormData and returns its failure rather than redirecting: it is
 * called from a row's icon button, not a form, and no error boundary can catch a server action
 * — so a failure has to come back as a value for the caller to toast.
 *
 * Both invalidations are load-bearing and they do different jobs. updateTag kills the cached
 * public reads, without which a freshly published recipe stays missing from /recipes for the
 * revalidate window. revalidatePath refreshes /admin/manage's own entry in the client router
 * cache — that page is uncached, so no tag covers it, and without this the row keeps rendering
 * the state it had before the click.
 */
export async function togglePublished(id: number, published: boolean): Promise<RecipeMutationState> {
  await requireUser();

  const parsed = publishToggleSchema.safeParse({ id, published });

  if (!parsed.success) {
    return { error: "That recipe could not be identified." };
  }

  const supabase = await createClient();

  // .select() is not decoration. A write that RLS refuses comes back with no error and zero rows
  // affected, so without reading the result a silent no-op would report success.
  const { data, error } = await supabase.from("recipes").update({ published: parsed.data.published }).eq("id", parsed.data.id).select("id");

  if (error) {
    return { error: "Failed to update the recipe: " + error.message };
  }

  if (data.length === 0) {
    return { error: "That recipe no longer exists, or you are no longer signed in." };
  }

  updateTag("recipes");
  revalidatePath("/admin/manage");

  return {};
}

/**
 * Deletes one recipe. Its ingredients, steps and image rows go with it — every child's `recipe_id`
 * is `on delete cascade`, so there is no *row* cleanup to write here and none should be added.
 *
 * **Files are the exception, and they are the reason this function got longer.** Postgres has no
 * idea the Storage bucket exists, so cascade removes the rows naming the photos and leaves the
 * photos themselves in the bucket forever. CLAUDE.md's "don't write cleanup code for child rows"
 * is about rows and stays true; read literally it would tell you to delete the block below.
 *
 * The order is deliberate and each step is forced by the one before it:
 *
 *  1. read the paths — once the row is gone, cascade has taken the only record of which files
 *     belonged to it;
 *  2. delete the row, letting cascade take the children;
 *  3. remove the files, best effort, never failing the action.
 *
 * Step 2 before step 3 is the counterintuitive part. It fixes which way a half-failure falls:
 * rows-first leaves *files orphaned, rows gone*, which is harmless and is what the sweep in
 * docs/known-issues.md exists to collect. Files-first risks *files gone, rows still referencing
 * them*, which is a live recipe rendering broken images at visitors. Every failure here falls
 * toward wasted bytes and never toward a broken reference (decision 11).
 */
export async function deleteRecipe(id: number): Promise<RecipeMutationState> {
  await requireUser();

  const parsed = recipeIdSchema.safeParse(id);

  if (!parsed.success) {
    return { error: "That recipe could not be identified." };
  }

  const supabase = await createClient();

  // Read first — see the ordering note above. Failures here are ignored rather than reported: not
  // knowing which files to delete is a reason to leak them, not a reason to refuse the delete.
  const [{ data: images }, { data: steps }] = await Promise.all([
    supabase.from("recipe_images").select("storage_path").eq("recipe_id", parsed.data),
    supabase.from("recipe_steps").select("image_path").eq("recipe_id", parsed.data),
  ]);

  const paths = [...(images ?? []).map((image) => image.storage_path), ...(steps ?? []).map((step) => step.image_path)].filter((path): path is string => path !== null);

  // Same reason as above: an RLS refusal on a delete is silent, so the affected rows are checked.
  const { data, error } = await supabase.from("recipes").delete().eq("id", parsed.data).select("id");

  if (error) {
    return { error: "Failed to delete the recipe: " + error.message };
  }

  if (data.length === 0) {
    return { error: "That recipe no longer exists, or you are no longer signed in." };
  }

  if (paths.length > 0) {
    // ⚠ The asymmetry with the line above is deliberate, and unexplained it reads as an oversight
    // and gets "fixed" into failing a delete that worked. A zero-row *row* delete means the user's
    // intent failed and is actionable. A zero-row *file* remove means the intent succeeded — the
    // recipe is gone — and a file leaked, which the owner cannot act on and which the sweep exists
    // for. So this checks neither the error nor the count (decisions 11 and 50).
    //
    // The cost accepted with it: a regressed `select` policy on storage.objects would make every
    // remove here silently affect nothing. `npm run db:diff:storage` is what catches that, earlier
    // and more plainly than a count check here could.
    await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  }

  updateTag("recipes");
  revalidatePath("/admin/manage");

  return {};
}
