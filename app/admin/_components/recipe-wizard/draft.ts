// import lib
import { slugify } from "@/lib/utils";

// import types
import type { RecipeInput } from "@/lib/recipes/schema";
import type { RecipeView } from "@/types/recipes";

/**
 * The wizard's client state, and the two things it turns into: the payload the server action
 * parses, and the view the live preview renders.
 *
 * Every field is a string because every field is an input. Numbers are parsed on the way out,
 * once, in `toPayload()` — keeping the raw text in state is what lets someone type "0," on the
 * way to "0,5" without the value collapsing under them.
 */

export type IngredientDraft = { amount: string; unit: string; name: string };

/**
 * One photo's entire state, as one field rather than three.
 *
 * `null` is "no photo". The three statuses are the pipeline in `upload.ts`, collapsed to what the
 * rest of the wizard needs to know — `busy` covers both the canvas work and the byte transfer,
 * because `attachment.tsx` renders `processing` and `uploading` identically and the distinction
 * would be one the UI never draws (decision 47).
 *
 * **The union is the point, not the brevity.** Three separate fields would permit "has a path
 * *and* an error", which is meaningless; this shape makes it unrepresentable. And because the
 * state lives on the row, deleting a step takes its state with it — a busy `Set` or error `Map`
 * lifted into `RecipeWizard` outlives the row it describes, so Review would go on reporting a
 * failure for a step that no longer exists, with Publish blocked and no reachable cause
 * (decision 18).
 */
export type StepImage = null | { status: "busy" } | { status: "done"; path: string } | { status: "failed"; reason: string };

/**
 * `id` is client-only and exists for one job: an upload resolves seconds after it starts, and the
 * only mutation primitive is positional. Start an upload on step 3, click ↑ on step 4, and the
 * finished path lands on the wrong step while the genuinely busy one stays `{status:"busy"}`
 * forever — `uploading` never clears, Publish is disabled permanently, and nothing on screen says
 * why. So write-backs go through `replaceById` below, not `replaceAt` (decision 31).
 *
 * It never reaches the payload: `toPayload()` maps step fields explicitly. SSR and hydration
 * generating different ids is harmless for the same reason — it never reaches the DOM. On the
 * edit path later, the real `recipe_steps.id` hydrates into this field.
 */
export type StepDraft = { id: string; instruction: string; note: string; image: StepImage };

export type Draft = {
  title: string;
  description: string;
  difficulty: string;
  prep_minutes: string;
  cook_minutes: string;
  servings: string;
  cover: StepImage;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  published: boolean;
};

/** Radix Select refuses an empty string as an item value, so "unset" stands in for "no difficulty". */
export const NO_DIFFICULTY = "unset";

export const EMPTY_INGREDIENT: IngredientDraft = { amount: "", unit: "", name: "" };

/**
 * Factories, not shared constants — `{ ...EMPTY_STEP }` would clone one id onto every row, which
 * is the one thing the id exists to prevent. `RecipeWizard` uses the lazy `useState(() =>
 * emptyDraft())` for the same reason.
 */
export function newStep(): StepDraft {
  return { id: crypto.randomUUID(), instruction: "", note: "", image: null };
}

export function emptyDraft(): Draft {
  return {
    title: "",
    description: "",
    difficulty: NO_DIFFICULTY,
    prep_minutes: "",
    cook_minutes: "",
    servings: "",
    cover: null,
    ingredients: [{ ...EMPTY_INGREDIENT }],
    steps: [newStep()],
    published: false,
  };
}

/* ------------------------------------------------------------------------------------------ *
 * Sanitisers
 *
 * These are what make the stepper's ✓ trustworthy. The tick is a zod `safeParse`, so anything
 * typeable that zod rejects would un-tick the step and re-lock Review with nothing on screen
 * saying why — worse than a wrong tick, not better. Removing the invalid state is the fix;
 * reporting it is not (decision 2).
 *
 * There are two rules because the schema has two: prep/cook/servings are
 * `optionalNumber({ integer: true })`, ingredient amount is `{ integer: false }`.
 *
 * **There is deliberately no sanitiser for the image fields, and that is not an oversight.** The
 * rule in CLAUDE.md — a field with a validation rule and no keystroke sanitiser makes the tick lie
 * — exists because inputs are *typed*. `ImageField` has no text input: it yields either `null` or
 * a path its own pipeline just built, so the state the schema rejects is unreachable by
 * construction rather than sanitised away. Do not bolt a meaningless sanitiser onto a field with
 * no keystrokes, and do not read this absence as the rule being optional.
 * ------------------------------------------------------------------------------------------ */

/** Whole minutes and whole people. A minus sign, a decimal point and `abc` are all untypeable. */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Amounts take digits plus at most one separator — a dot, a comma or a slash.
 *
 * The comma is not a nicety: `Number("0,5")` is `NaN`, and a Dutch keyboard and a Dutch cook both
 * produce a comma. Blocking it means a keystroke that silently does nothing. The slash is there
 * because "1/2 tl" is how a recipe is actually written.
 */
export function amountChars(value: string) {
  let separatorSeen = false;

  return [...value.replace(/[^\d.,/]/g, "")]
    .filter((character) => {
      if (/\d/.test(character)) return true;
      if (separatorSeen) return false;

      separatorSeen = true;
      return true;
    })
    .join("");
}

/**
 * "0,5" · "0.5" · "1/2" all mean the same number.
 *
 * Returns null for anything that does not resolve — including the half-typed states the
 * sanitiser above deliberately allows through ("1/", ".", "0/0"). That is not silent: null means
 * "no amount", the live preview renders the ingredient without one, and the next keystroke fixes
 * it. Failing the parse instead would un-tick the step mid-word, which is the thing decision 2
 * exists to avoid.
 */
export function parseAmount(value: string): number | null {
  const text = value.trim().replace(",", ".");
  if (!text) return null;

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);

  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/* ------------------------------------------------------------------------------------------ */

/**
 * Draft → the exact object `recipeSchema` parses and `save_recipe()` reads.
 *
 * The stepper parses slices of *this*, not of the draft, so the ✓ marks are checking the thing
 * that will actually be submitted rather than something adjacent to it. Empty strings are left
 * as-is for the fields the schema normalises itself; only the two conversions the schema cannot
 * do — the difficulty sentinel and the fraction — happen here.
 *
 * **The images are the one place this stops being a literal pass-through, and that is worth
 * saying.** The original argument for this function was that the draft holds exactly the fields
 * `save_recipe()` reads, so nothing can be lost in translation. The substance survives — the draft
 * holds a *path* and never a `File`, the submit is still one JSON blob and one transaction, and
 * each ✓ still parses this payload rather than the draft — but `StepImage` is a union, so a path
 * has to be picked out of it. That union is what makes "has a path *and* an error" unrepresentable
 * and what makes a deleted step take its own state with it (decision 18); a plain
 * `image_path: string | null` on the row would restore the pass-through and lose both.
 *
 * A photo still uploading or failed contributes nothing here: `busy` and `failed` both resolve to
 * null. `RecipeWizard` is what stops a half-finished upload from quietly reaching the database as
 * an absent image — it blocks the submit while either is true.
 */
export function toPayload(draft: Draft): RecipeInput {
  return {
    slug: slugify(draft.title),
    title: draft.title,
    description: draft.description,
    difficulty: draft.difficulty === NO_DIFFICULTY ? null : (draft.difficulty as RecipeInput["difficulty"]),
    prep_minutes: draft.prep_minutes,
    cook_minutes: draft.cook_minutes,
    servings: draft.servings,

    // Deferred, not removed — the column and save_recipe's read of it both stay (decision 16).
    notes: null,

    published: draft.published,
    ingredients: draft.ingredients.map((ingredient) => ({
      name: ingredient.name,
      amount: parseAmount(ingredient.amount),
      unit: ingredient.unit,
    })),
    steps: draft.steps.map((step) => ({ instruction: step.instruction, note: step.note, image_path: step.image?.status === "done" ? step.image.path : null })),

    // A list carrying at most one row, flagged primary. `recipe_images` supports many rows with
    // sort_order and one primary, so shaping the payload this way makes a gallery later a UI
    // change rather than a payload change (decision 1).
    images: draft.cover?.status === "done" ? [{ storage_path: draft.cover.path, is_primary: true }] : [],
  };
}

/**
 * Draft → what the live preview renders, which is the real `RecipeArticle` and not a second
 * renderer built to look like it (decision 15).
 *
 * Two presentation-only differences from `toPayload`, and they exist because this runs against a
 * half-filled form rather than a saved recipe: blank rows are dropped so an untouched ingredient
 * line does not render as an empty bullet, and the numbers are coerced loosely — `Number("")` is
 * 0, so anything that is not a positive number becomes null and the article simply omits that
 * entry.
 *
 * What is *missing* is not filled in here. An empty title stays empty and the article renders
 * "Untitled recipe" itself, under its `placeholders` prop, along with the rest of the empty
 * skeleton — a placeholder smuggled into the data would also be what the checklist and any future
 * reader of this view see.
 *
 * The step filter is the third difference, and it is about photos. Attaching a photo before typing
 * the instruction is the natural order of work, so a step with a finished photo and no text is
 * kept: without that the preview shows no trace of a photo that is genuinely in the draft and
 * genuinely about to be saved. The article renders "No instruction yet." beneath it under
 * `placeholders`, which is only ever reachable here — the prop is off on both saved-recipe routes
 * (decision 26).
 */
export function toPreview(draft: Draft): RecipeView {
  const minutes = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    difficulty: draft.difficulty === NO_DIFFICULTY ? null : (draft.difficulty as RecipeView["difficulty"]),
    prep_minutes: minutes(draft.prep_minutes),
    cook_minutes: minutes(draft.cook_minutes),
    servings: minutes(draft.servings),
    notes: null,

    // Flat, not a `recipe_images` row array — see the note on `RecipeView` in types/recipes.ts.
    // Carrying the row shape here would make the wizard fabricate a one-element list of fake image
    // rows, which is the exact pattern that view exists to prevent (decision 37).
    cover: draft.cover?.status === "done" ? draft.cover.path : null,

    ingredients: draft.ingredients
      .filter((ingredient) => ingredient.name.trim())
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        amount: parseAmount(ingredient.amount),
        unit: ingredient.unit.trim() || null,
      })),
    steps: draft.steps
      .filter((step) => step.instruction.trim() || step.image?.status === "done")
      .map((step) => ({ instruction: step.instruction.trim(), note: step.note.trim() || null, image_path: step.image?.status === "done" ? step.image.path : null })),
  };
}

/** Moves an item without mutating, returning the original array when the move is out of bounds. */
export function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return next;
}

export function replaceAt<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

/**
 * The same patch, addressed by identity rather than by position.
 *
 * **Use this for anything that lands asynchronously.** `replaceAt` is correct for a keystroke,
 * where the row cannot have moved between the event and the setState. An upload resolves seconds
 * later, by which time the user may have reordered or deleted the row — and a positional write
 * then patches whichever step now sits at that index, leaving the real one busy forever
 * (decision 31). A row that has been deleted matches nothing and the patch is dropped, which is
 * the correct outcome: its state went with it.
 */
export function replaceById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
