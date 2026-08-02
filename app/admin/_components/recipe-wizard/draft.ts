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
export type StepDraft = { instruction: string; note: string };

export type Draft = {
  title: string;
  description: string;
  difficulty: string;
  prep_minutes: string;
  cook_minutes: string;
  servings: string;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  published: boolean;
};

/** Radix Select refuses an empty string as an item value, so "unset" stands in for "no difficulty". */
export const NO_DIFFICULTY = "unset";

export const EMPTY_INGREDIENT: IngredientDraft = { amount: "", unit: "", name: "" };
export const EMPTY_STEP: StepDraft = { instruction: "", note: "" };

export const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  difficulty: NO_DIFFICULTY,
  prep_minutes: "",
  cook_minutes: "",
  servings: "",
  ingredients: [{ ...EMPTY_INGREDIENT }],
  steps: [{ ...EMPTY_STEP }],
  published: false,
};

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
    steps: draft.steps.map((step) => ({ instruction: step.instruction, note: step.note })),
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
    ingredients: draft.ingredients
      .filter((ingredient) => ingredient.name.trim())
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        amount: parseAmount(ingredient.amount),
        unit: ingredient.unit.trim() || null,
      })),
    steps: draft.steps.filter((step) => step.instruction.trim()).map((step) => ({ instruction: step.instruction.trim(), note: step.note.trim() || null })),
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
