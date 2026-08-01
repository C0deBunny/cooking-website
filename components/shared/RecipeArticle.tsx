// import components
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// import types
import type { RecipeIngredient, RecipeWithChildren } from "@/types/recipes";

/**
 * Renders one recipe. Lives in shared/ rather than under a route because two routes use it:
 * the public /recipes/[slug] and the owner-only /admin/preview/[slug], which differ only in
 * which query feeds them.
 *
 * Images are absent on purpose — no Storage bucket exists yet, see docs/image-storage.md.
 */

/**
 * Groups ingredients by their label, preserving list order rather than sorting by it.
 *
 * A new group starts whenever the label changes, which is what makes "group order = order of
 * first appearance" work without storing a group position. If a label reappears after a
 * different one, it becomes a second group with the same heading — the interleaving that
 * recipeSchema's contiguity check exists to prevent.
 */
function groupIngredients(ingredients: RecipeIngredient[]) {
  const groups: { label: string | null; items: RecipeIngredient[] }[] = [];

  for (const ingredient of ingredients) {
    const current = groups.at(-1);

    if (current && current.label === ingredient.group_label) {
      current.items.push(ingredient);
    } else {
      groups.push({ label: ingredient.group_label, items: [ingredient] });
    }
  }

  return groups;
}

/** "1 h 30" reads better than "90 min" past an hour. */
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** Amounts are numeric in the database, so 0.5 arrives as 0.5 and 2 as 2 — no trailing ".0". */
function formatAmount(ingredient: RecipeIngredient) {
  const parts = [ingredient.amount === null ? null : String(ingredient.amount), ingredient.unit].filter(Boolean);
  return parts.join(" ");
}

export default function RecipeArticle({ recipe }: { recipe: RecipeWithChildren }) {
  const groups = groupIngredients(recipe.recipe_ingredients);

  // Computed here rather than stored: a generated total column would have had to decide whether
  // a recipe with no times recorded means 0 or unknown. See decision 9.
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  // `.filter(Boolean)` does not narrow away null in TypeScript, so the predicate is explicit.
  const meta = [
    recipe.prep_minutes === null ? null : { label: "Prep", value: formatMinutes(recipe.prep_minutes) },
    recipe.cook_minutes === null ? null : { label: "Cooking", value: formatMinutes(recipe.cook_minutes) },
    total > 0 && recipe.prep_minutes !== null && recipe.cook_minutes !== null ? { label: "Total", value: formatMinutes(total) } : null,
    recipe.servings === null ? null : { label: "Serves", value: String(recipe.servings) },
  ].filter((entry): entry is { label: string; value: string } => entry !== null);

  return (
    <article className="w-full text-foreground">
      <header className="bg-foreground/5 w-full">
        <div className="w-full max-w-3xl mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">{recipe.difficulty ? <Badge variant="secondary">{recipe.difficulty}</Badge> : null}</div>

          <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>

          {recipe.description ? <p className="text-lg text-muted-foreground">{recipe.description}</p> : null}

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

      <div className="w-full max-w-3xl mx-auto px-6 py-12">
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="text-2xl font-semibold mb-6">
            Ingredients
          </h2>

          {groups.map((group, index) => (
            <div key={`${group.label ?? "ungrouped"}-${index}`} className="mb-6 last:mb-0">
              {group.label ? <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{group.label}</h3> : null}

              <ul className="space-y-2">
                {group.items.map((ingredient) => {
                  const amount = formatAmount(ingredient);

                  return (
                    <li key={ingredient.id} className="flex gap-4 border-b border-border pb-2 last:border-b-0">
                      {amount ? <span className="shrink-0 font-medium tabular-nums">{amount}</span> : null}
                      <span className={amount ? "text-muted-foreground" : undefined}>{ingredient.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <Separator className="my-12" />

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-2xl font-semibold mb-6">
            Method
          </h2>

          <ol className="space-y-8">
            {recipe.recipe_steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-sm font-semibold tabular-nums">
                  {step.step_number}
                </span>

                <div className="space-y-2 pt-1">
                  <p>{step.instruction}</p>
                  {step.note ? <p className="text-sm text-muted-foreground italic">{step.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
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
