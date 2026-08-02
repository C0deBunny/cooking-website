// import lib
import { cn } from "@/lib/utils";

// import components
import DifficultyBadge from "@/components/shared/DifficultyBadge";
import { Separator } from "@/components/ui/separator";

// import types
import type { RecipeView, RecipeWithChildren } from "@/types/recipes";

/**
 * Renders one recipe. Lives in shared/ rather than under a route because three things use it:
 * the public /recipes/[slug], the owner-only /admin/preview/[slug], and the create wizard's live
 * preview. The first two differ only in which query feeds them; the third has no query at all,
 * which is why the prop is RecipeView rather than a row — see types/recipes.ts.
 *
 * Images are absent on purpose — no Storage bucket exists yet, see docs/image-storage.md.
 *
 * ⚠ This component may never gain a server-only import. The wizard is a client component, so
 * importing it there compiles this file into the client bundle as well as leaving it a server
 * component for the two pages that render it from the server. It imports only Badge, Separator
 * and types today. `next/headers`, `cookies()` and any Supabase server client are therefore
 * off-limits here — nothing warns, and the failure arrives as a build error pointing at the
 * wizard rather than at the import that caused it. Decision 8 exists so that error is findable.
 */

/**
 * Row shape in, view shape out. Two callers, both server pages reading through Supabase.
 *
 * Lives here rather than in lib/recipes/ because a domain folder is exactly three files
 * (queries · actions · schema) and this is none of them, and because keeping it beside the
 * component means the day RecipeView gains a field, the thing that has to fill it is on screen.
 */
export function toRecipeView(recipe: RecipeWithChildren): RecipeView {
  return {
    title: recipe.title,
    description: recipe.description,
    difficulty: recipe.difficulty,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    servings: recipe.servings,
    notes: recipe.notes,
    ingredients: recipe.recipe_ingredients,
    steps: recipe.recipe_steps,
  };
}

/** "1 h 30" reads better than "90 min" past an hour. */
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/**
 * Recipes are written with fractions, so they should read back as fractions.
 *
 * `amount` is `numeric`, which is the right storage — it keeps arithmetic and exact decimals —
 * but it means "½ tl" typed into the form is stored as 0.5 and would otherwise render as
 * "0.5 tl". This maps the decimals a cook actually types back to the glyph, so the round trip
 * looks like what was entered. Presentation only; the column does not change.
 *
 * Keyed on the fractional part rounded to two places, so 1/3 (0.3333…) finds ⅓. Anything without
 * a clean glyph prints as the number — 0.4 stays "0.4" rather than being forced into a fraction
 * it is not.
 */
const FRACTION_GLYPHS: Record<string, string> = {
  "0.5": "½",
  "0.25": "¼",
  "0.75": "¾",
  "0.33": "⅓",
  "0.67": "⅔",
};

function formatQuantity(amount: number) {
  const whole = Math.floor(amount);
  const glyph = FRACTION_GLYPHS[String(Number((amount - whole).toFixed(2)))];

  if (!glyph) return String(amount);

  // 1.5 is "1½", but 0.5 is "½" and not "0½".
  return whole > 0 ? `${whole}${glyph}` : glyph;
}

function formatAmount(ingredient: RecipeView["ingredients"][number]) {
  const parts = [ingredient.amount === null ? null : formatQuantity(ingredient.amount), ingredient.unit].filter(Boolean);
  return parts.join(" ");
}

/**
 * The empty states the live preview needs and the two saved-recipe routes must not have.
 *
 * A published recipe with no description simply has no description paragraph; a *draft being
 * typed* has one that isn't written yet, and those are different statements. Rendering the second
 * on a public page would announce a gap to a reader who cannot fill it — so the placeholders are
 * opt-in, and only the wizard opts in (see the `placeholders` prop below).
 */
const PLACEHOLDER_TEXT = "text-sm text-muted-foreground italic";

const PLACEHOLDER_META = [
  { label: "Prep", value: "—" },
  { label: "Cooking", value: "—" },
  { label: "Serves", value: "—" },
];

/**
 * `placeholders` turns the empty article into a skeleton of the page being written rather than a
 * stack of bare headings. Off everywhere a saved recipe is rendered; on in the wizard, where the
 * article starts empty by definition and every section is about to be filled in.
 *
 * It changes nothing about a *filled* article, so the preview and the published page still can't
 * drift — the flag only decides what stands in for what is missing.
 *
 * `align` moves the 3xl reading column, and nothing inside it. On a recipe page the column is
 * centred in the viewport, which is where a body of text belongs; on Review it sits inside a card
 * that is already part of a left-aligned wizard, and centring a narrower column inside a wider
 * panel just makes it float away from the checklist above it. Both stay one layout — the column
 * width, the type scale and the spacing are untouched.
 */
export default function RecipeArticle({ recipe, placeholders = false, align = "center" }: { recipe: RecipeView; placeholders?: boolean; align?: "center" | "start" }) {
  const column = cn("w-full max-w-3xl", align === "center" && "mx-auto");

  // Computed here rather than stored: a generated total column would have had to decide whether
  // a recipe with no times recorded means 0 or unknown. See decision 9.
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  const title = recipe.title.trim();

  // `.filter(Boolean)` does not narrow away null in TypeScript, so the predicate is explicit.
  const filled = [
    recipe.prep_minutes === null ? null : { label: "Prep", value: formatMinutes(recipe.prep_minutes) },
    recipe.cook_minutes === null ? null : { label: "Cooking", value: formatMinutes(recipe.cook_minutes) },
    total > 0 && recipe.prep_minutes !== null && recipe.cook_minutes !== null ? { label: "Total", value: formatMinutes(total) } : null,
    recipe.servings === null ? null : { label: "Serves", value: String(recipe.servings) },
  ].filter((entry): entry is { label: string; value: string } => entry !== null);

  // All or nothing: the dashes are a shape for the row, so they appear only while the whole row is
  // absent. Once one time is typed the row is real and the untyped ones stay off, exactly as on a
  // saved recipe that records prep but not cooking.
  const meta = filled.length > 0 ? filled : placeholders ? PLACEHOLDER_META : [];

  return (
    <article className="w-full text-foreground">
      <header className="bg-foreground/5 w-full">
        <div className={cn(column, "px-6 py-8")}>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <DifficultyBadge difficulty={recipe.difficulty} />
          </div>

          <h1 className={cn("text-4xl font-bold mb-4", placeholders && !title && "font-semibold text-muted-foreground italic")}>{placeholders && !title ? "Untitled recipe" : recipe.title}</h1>

          {recipe.description ? <p className="text-lg text-muted-foreground">{recipe.description}</p> : placeholders ? <p className={PLACEHOLDER_TEXT}>No description yet.</p> : null}

          {meta.length > 0 ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-8">
              {meta.map((entry) => (
                <div key={entry.label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{entry.label}</dt>
                  <dd className="text-base font-medium">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </header>

      <div className={cn(column, "px-6 py-12")}>
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="text-2xl font-semibold mb-6">
            Ingredients
          </h2>

          {/* Keyed by index, and step numbers below are index + 1. Both are correct only because
              the article is a static render of an already-ordered list: getRecipeBySlug and
              getDraftBySlug order the children in the query, and the wizard's draft is ordered by
              the array the user arranged. A caller that skips that ordering renumbers the method
              silently. See decision 7. */}
          {recipe.ingredients.length === 0 && placeholders ? (
            <p className={PLACEHOLDER_TEXT}>No ingredients yet.</p>
          ) : (
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => {
                const amount = formatAmount(ingredient);

                return (
                  <li key={index} className="flex gap-4 border-b border-border pb-2 last:border-b-0">
                    {amount ? <span className="shrink-0 font-medium tabular-nums">{amount}</span> : null}
                    <span className={amount ? "text-muted-foreground" : undefined}>{ingredient.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator className="my-12" />

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-2xl font-semibold mb-6">
            Method
          </h2>

          {recipe.steps.length === 0 && placeholders ? (
            <p className={PLACEHOLDER_TEXT}>No steps yet.</p>
          ) : (
            <ol className="space-y-8">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-sm font-semibold tabular-nums">
                    {index + 1}
                  </span>

                  <div className="space-y-2 pt-1">
                    <p>{step.instruction}</p>
                    {step.note ? <p className="text-sm text-muted-foreground italic">{step.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {recipe.notes ? (
          <>
            <Separator className="my-12" />

            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="text-2xl font-semibold mb-4">
                Notes
              </h2>
              <p className="text-muted-foreground whitespace-pre-line">{recipe.notes}</p>
            </section>
          </>
        ) : null}
      </div>
    </article>
  );
}
