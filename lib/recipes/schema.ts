// import lib
import { z } from "zod";

// import types
import type { RecipeDifficulty } from "@/types/recipes";

/**
 * The payload shape `save_recipe(payload jsonb)` parses. These two are a hand-synced contract —
 * a field added here has to be read in the SQL function, and vice versa. Keep them in view of
 * each other when either changes.
 *
 * zod is v4 here (`z.email()`, not `z.string().email()`); v3 snippets will not compile.
 */

/**
 * An untouched optional input arrives as `""`, which is not the same as "absent". Left alone it
 * would become an empty notes block, a heading with no text, or `0` where the user meant
 * "unknown". Everything optional funnels through here so that normalisation happens once.
 */
const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
});

/** Same idea for numbers, mirroring the `> 0` checks the database enforces. */
function optionalNumber({ integer, label }: { integer: boolean; label: string }) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : Number(trimmed);
    })
    .refine((value) => value === null || (Number.isFinite(value) && value > 0), { message: `${label} must be greater than 0.` })
    .refine((value) => value === null || !integer || Number.isInteger(value), { message: `${label} must be a whole number.` });
}

// Guarded against the generated enum rather than restated: if a difficulty is ever added or
// renamed in the database, `satisfies` fails here instead of at runtime.
const DIFFICULTIES = ["easy", "medium", "hard"] as const satisfies readonly RecipeDifficulty[];

const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Every ingredient needs a name."),
  amount: optionalNumber({ integer: false, label: "Amount" }),
  unit: optionalText,
});

const stepSchema = z.object({
  instruction: z.string().trim().min(1, "Every step needs an instruction."),
  note: optionalText,
});

/**
 * The three wizard steps, as schemas.
 *
 * Split so that each step's ✓ in the stepper can be that step's own `safeParse(...).success` and
 * nothing else. A hand-written "is this step complete?" helper always drifts from the schema —
 * the first mockup ticked Details on `title.trim().length > 0` while `optionalNumber` rejects
 * NaN, so typing `abc` into Prep time produced **Details ✓ Complete**, an unlocked Review step,
 * and then a server rejection reading "Prep time must be greater than 0."
 *
 * The split only pays off while it stays honest, and it is honest only because every input that
 * could produce an invalid value is sanitised at the keystroke — see the sanitisers in
 * `app/admin/_components/recipe-wizard/draft.ts`. Wire up a new field with a rule and no
 * sanitiser and the tick goes green over a value the server will reject. Nothing enforces this.
 *
 * Which field sits in which step is a layout decision, not a data one: `servings` is in
 * Ingredients because the amounts are relative to it (decision 6).
 */
export const detailsSchema = z.object({
  // Derived from the title by slugify() and never shown as an editable field, so this failing is
  // reachable in exactly one way: a title with nothing in `[a-z0-9]` to build an address from
  // ("№1", an emoji, non-Latin script). The wizard says so on the URL line, because the tick
  // going quiet with no explanation is a dead end — decision 10.
  slug: z
    .string()
    .trim()
    .min(1, "A recipe needs a slug.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The slug may only contain lowercase letters, numbers and single hyphens."),

  title: z.string().trim().min(1, "A recipe needs a title."),
  description: optionalText,
  difficulty: z.union([z.enum(DIFFICULTIES), z.null(), z.undefined()]).transform((value) => value ?? null),

  prep_minutes: optionalNumber({ integer: true, label: "Prep time" }),
  cook_minutes: optionalNumber({ integer: true, label: "Cook time" }),
});

export const ingredientsSchema = z.object({
  servings: optionalNumber({ integer: true, label: "Servings" }),
  ingredients: z.array(ingredientSchema).min(1, "A recipe needs at least one ingredient."),
});

export const stepsSchema = z.object({
  steps: z.array(stepSchema).min(1, "A recipe needs at least one step."),
});

/**
 * The whole payload `save_recipe()` parses — the three above plus the fields that belong to no
 * step: the id that tells the function insert from update, the publish switch on Review, and
 * notes, which is deferred and currently always sent as null (decision 16).
 *
 * Composed by spreading `.shape` rather than `.merge()`, which is deprecated in zod 4.
 */
export const recipeSchema = z.object({
  // Absent on create, present on edit. The function branches on it rather than upserting by
  // slug, which is what makes renaming a slug an update instead of a fork.
  id: z.number().int().positive().nullable().optional(),

  notes: optionalText,
  published: z.boolean().default(false),

  ...detailsSchema.shape,
  ...ingredientsSchema.shape,
  ...stepsSchema.shape,
});

/** What the form sends and the action validates. */
export type RecipeInput = z.input<typeof recipeSchema>;

/** What the action passes to the database, after normalisation. */
export type RecipePayload = z.output<typeof recipeSchema>;

/**
 * State object returned to useActionState by saveRecipe.
 *
 * `takenSlug` carries the one failure the form can act on rather than only report. The wizard has
 * no slug field to correct — the address follows the title, always (decision 9) — so a collision
 * has to be answered by changing the title, and the wizard says so on the URL line as well as on
 * Review (decision 11). It holds the slug that collided rather than a boolean so the warning
 * clears itself: the wizard compares it against the slug the current title derives, and a single
 * keystroke in the title makes them differ.
 */
export type RecipeFormState = {
  error?: string;
  takenSlug?: string;
};

/**
 * The one message two code paths have to agree on.
 *
 * A collision is now reported from two places — the live check as the title is typed, and the
 * 23505 branch in `saveRecipe` after a submit that raced it — and they must not word it
 * differently, or the same problem reads as two problems depending on when it was noticed.
 */
export function slugTakenMessage(slug: string) {
  return `The address "${slug}" is already used by another recipe. Choose a different title.`;
}

/**
 * The manage page's two mutations.
 *
 * These validate a bare id rather than a form payload, and they do it for the same reason the
 * payload is validated: a server action compiles to a public HTTP endpoint, so its arguments are
 * not trustworthy merely because our own UI is what normally sends them.
 */
export const recipeIdSchema = z.number().int().positive();

export const publishToggleSchema = z.object({
  id: recipeIdSchema,
  published: z.boolean(),
});

/**
 * What the manage page's mutations return. Deliberately not RecipeFormState — these are not
 * forms and are not driven by useActionState, and collapsing the two would invite someone to
 * wire one into the other.
 */
export type RecipeMutationState = {
  error?: string;
};
