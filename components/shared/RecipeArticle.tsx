// import lib
import { cn } from "@/lib/utils";
import { publicImageUrl } from "@/lib/supabase/storage";

// import components
import Image from "next/image";
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
 * Photos are rendered here rather than only in the wizard because the wizard's live preview *is*
 * this component. Leaving them out would mean a preview that omits the photos just uploaded, which
 * is a preview that lies about what is being published (decision 12).
 *
 * Every stored photo is already a square, cropped by the person who uploaded it, so nothing here
 * crops anything: the file *is* the final framing. That is why there is no aspect handling below
 * and no "this photo will be cropped" warning anywhere (decision 13).
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

    // The rows carry sort_order and is_primary; the article is told about neither. Resolving the
    // primary here is what keeps `RecipeView` a view rather than a row shape, and it is also where
    // a gallery would later branch (decision 37).
    cover: recipe.recipe_images.find((image) => image.is_primary)?.storage_path ?? null,

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

  const heading = (
    <h1 className={cn("text-4xl font-bold mb-4", placeholders && !title && "font-semibold text-muted-foreground italic")}>{placeholders && !title ? "Untitled recipe" : recipe.title}</h1>
  );

  const description = recipe.description ? <p className="text-lg text-muted-foreground">{recipe.description}</p> : placeholders ? <p className={PLACEHOLDER_TEXT}>No description yet.</p> : null;

  const metaRow =
    meta.length > 0 ? (
      <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-8">
        {meta.map((entry) => (
          <div key={entry.label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{entry.label}</dt>
            <dd className="text-base font-medium">{entry.value}</dd>
          </div>
        ))}
      </dl>
    ) : null;

  /**
   * Three headers, and the fork is the `placeholders` line that already exists.
   *
   * With a cover: an overlaid square at *column* width, not full-bleed. A square that wide is that
   * tall, so a viewport-wide version would put everything else permanently below the fold — and
   * the obvious bound, `max-h` plus `object-cover`, would re-crop the square the user just framed
   * and hand back the warning decision 13 deleted. Column-bleed needs no new layout rule, since
   * the article is `max-w-3xl` throughout, and is identical at every width, so the preview rail
   * and the page agree with no breakpoint (decision 20).
   *
   * Without a cover, the fork: the wizard reserves the square as an empty dashed frame, a saved
   * recipe falls back to today's tinted band. That is what `placeholders` is for — a draft being
   * typed has a cover that is not chosen yet, a published recipe with no cover simply has none,
   * and showing visitors an empty dashed box announces a gap they cannot fill.
   *
   * **Reserving it is also what keeps `PreviewRail` correct.** The cover field lives on Details,
   * but an upload still in flight when Next is pressed lands while the user is on Ingredients —
   * and that component's scroll effect depends only on `[step]`. A square appearing where nothing
   * was would move the article underneath a scroll position computed without it. Reserving the
   * space makes that unreachable rather than handled; remove it and `recipe.cover` has to join
   * that effect's dependency array (decision 21).
   */
  return (
    <article className="w-full text-foreground">
      {recipe.cover ? (
        <header className="bg-foreground/5 w-full">
          <div className={cn(column, "relative aspect-square overflow-hidden")}>
            <Image src={publicImageUrl(recipe.cover)} alt="" fill sizes="(max-width: 768px) 100vw, 768px" priority className="object-cover" />

            {/* A scrim rather than a solid bar: the text sits on the photo, so it needs contrast
                that survives whatever is underneath it. */}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" />

            {/* alt="" on the image above, deliberately. The title is overlaid on this photo, so
                the accessible name is already adjacent and a description would be a duplicate. */}
            <div className="absolute inset-x-0 bottom-0 px-6 py-8 text-white">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <DifficultyBadge difficulty={recipe.difficulty} />
              </div>

              <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
              {recipe.description ? <p className="text-lg text-white/80">{recipe.description}</p> : null}

              {meta.length > 0 ? (
                <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-8">
                  {meta.map((entry) => (
                    <div key={entry.label}>
                      <dt className="text-xs uppercase tracking-wide text-white/70">{entry.label}</dt>
                      <dd className="text-base font-medium">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-foreground/5 w-full">
          {/* One element, two shapes. Under `placeholders` the square is reserved as an empty
              dashed frame with the text sitting at its foot — no scrim, ordinary foreground text,
              because there is no photo to sit on. Off it, this is exactly the band the article had
              before covers existed. */}
          <div className={cn(column, "px-6 py-8", placeholders && "flex aspect-square flex-col justify-end border-2 border-dashed border-border")}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <DifficultyBadge difficulty={recipe.difficulty} />
            </div>

            {heading}
            {description}
            {metaRow}
          </div>
        </header>
      )}

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
                    {/* Reachable only in the wizard: a photo can be attached before the
                        instruction is typed, and `toPreview()` keeps such a step so the preview
                        shows the photo that is genuinely about to be saved (decision 26). */}
                    {step.instruction ? <p>{step.instruction}</p> : placeholders ? <p className={PLACEHOLDER_TEXT}>No instruction yet.</p> : null}

                    {step.note ? <p className="text-sm text-muted-foreground italic">{step.note}</p> : null}

                    {/* ~300px, indented to the text column, not full column width. The deciding
                        number is page height: at six steps, a 768px square per step runs to about
                        nine screens and the method stops reading as a sequence — one step per
                        screen. 300px is large enough to read as a photograph and small enough that
                        two or three steps share a screen (decision 22).

                        alt="" because this sits directly beneath the instruction that describes
                        it, so the accessible name is already adjacent. */}
                    {step.image_path ? (
                      <Image src={publicImageUrl(step.image_path)} alt="" width={300} height={300} sizes="300px" className="mt-4 aspect-square w-full max-w-75 rounded-xl object-cover" />
                    ) : null}
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
