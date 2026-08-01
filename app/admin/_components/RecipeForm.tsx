"use client";

// import lib
import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { slugify } from "@/lib/utils";

// import actions
import { saveRecipe } from "@/lib/recipes/actions";

// import components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// import types
import type { RecipeFormState } from "@/lib/recipes/schema";

/**
 * The whole recipe in one form, saved in one submit.
 *
 * Ingredients and steps live in client state as arrays and are serialised into a single hidden
 * `payload` field on submit — so the array order *is* the stored order, and reordering never has
 * to renumber anything. The server action parses that field, validates it with zod and hands it
 * to save_recipe(), which replaces both child sets inside one transaction.
 *
 * The alternative — indexed field names like ingredients.0.name — would mean deleting a middle
 * row leaves a gap and reordering means rewriting every name.
 */

type IngredientRow = { name: string; amount: string; unit: string };
type StepRow = { instruction: string; note: string };

const EMPTY_INGREDIENT: IngredientRow = { name: "", amount: "", unit: "" };
const EMPTY_STEP: StepRow = { instruction: "", note: "" };

// Radix Select refuses an empty string as an item value, so "unset" stands in for "no difficulty"
// and is mapped back to null in the payload.
const NO_DIFFICULTY = "unset";

/** Moves an item without mutating, returning the original array when the move is out of bounds. */
function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return next;
}

function replaceAt<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

/** Up / down / remove, shared by both row types so the two lists behave identically. */
function RowControls({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (from: number, to: number) => void; onRemove: (index: number) => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Remove" disabled={count === 1} onClick={() => onRemove(index)}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

export default function RecipeForm() {
  const [state, formAction, isPending] = useActionState<RecipeFormState, FormData>(saveRecipe, {});

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  // Once the slug has been edited by hand, stop overwriting it from the title.
  const [slugEdited, setSlugEdited] = useState(false);

  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<string>(NO_DIFFICULTY);
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [notes, setNotes] = useState("");
  const [published, setPublished] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...EMPTY_INGREDIENT }]);
  const [steps, setSteps] = useState<StepRow[]>([{ ...EMPTY_STEP }]);

  // The exact shape recipeSchema parses and save_recipe reads. Empty strings are left as-is:
  // the schema normalises them to null in one place rather than each caller guessing.
  const payload = {
    slug,
    title,
    description,
    difficulty: difficulty === NO_DIFFICULTY ? null : difficulty,
    prep_minutes: prepMinutes,
    cook_minutes: cookMinutes,
    servings,
    notes,
    published,
    ingredients,
    steps,
  };

  return (
    <form action={formAction} className="w-full max-w-3xl mx-auto px-6 py-12">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <h1 className="text-3xl font-bold mb-8">New recipe</h1>

      {state.error ? (
        <p role="alert" className="mb-8 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
            placeholder="Gestoofde bakbanaan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugEdited(true);
            }}
            placeholder="gestoofde-bakbanaan"
          />
          <p className="text-xs text-muted-foreground">The URL: /recipes/{slug || "…"}. Filled in from the title until you change it.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DIFFICULTY}>Not set</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prep">Prep (minutes)</Label>
            <Input id="prep" inputMode="numeric" value={prepMinutes} onChange={(event) => setPrepMinutes(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cook">Cooking (minutes)</Label>
            <Input id="cook" inputMode="numeric" value={cookMinutes} onChange={(event) => setCookMinutes(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Serves</Label>
            <Input id="servings" inputMode="numeric" value={servings} onChange={(event) => setServings(event.target.value)} />
          </div>
        </div>
      </div>

      <Separator className="my-10" />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setIngredients((rows) => [...rows, { ...EMPTY_INGREDIENT }])}>
            <Plus className="size-4" /> Add ingredient
          </Button>
        </div>

        <p className="mb-6 text-xs text-muted-foreground">The order here is the order on the page. Use the arrows to rearrange.</p>

        <ul className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
              <div className="w-20 space-y-1">
                <Label className="text-xs" htmlFor={`amount-${index}`}>
                  Amount
                </Label>
                <Input id={`amount-${index}`} inputMode="decimal" value={ingredient.amount} onChange={(event) => setIngredients((rows) => replaceAt(rows, index, { amount: event.target.value }))} />
              </div>

              <div className="w-24 space-y-1">
                <Label className="text-xs" htmlFor={`unit-${index}`}>
                  Unit
                </Label>
                <Input id={`unit-${index}`} value={ingredient.unit} onChange={(event) => setIngredients((rows) => replaceAt(rows, index, { unit: event.target.value }))} />
              </div>

              <div className="min-w-40 flex-1 space-y-1">
                <Label className="text-xs" htmlFor={`name-${index}`}>
                  Ingredient
                </Label>
                <Input id={`name-${index}`} value={ingredient.name} onChange={(event) => setIngredients((rows) => replaceAt(rows, index, { name: event.target.value }))} />
              </div>

              <RowControls
                index={index}
                count={ingredients.length}
                onMove={(from, to) => setIngredients((rows) => move(rows, from, to))}
                onRemove={(i) => setIngredients((rows) => rows.filter((_, r) => r !== i))}
              />
            </li>
          ))}
        </ul>
      </section>

      <Separator className="my-10" />

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Method</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setSteps((rows) => [...rows, { ...EMPTY_STEP }])}>
            <Plus className="size-4" /> Add step
          </Button>
        </div>

        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span aria-hidden className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-sm font-semibold tabular-nums">
                {index + 1}
              </span>

              <div className="flex-1 space-y-2">
                <Textarea
                  aria-label={`Step ${index + 1} instruction`}
                  value={step.instruction}
                  onChange={(event) => setSteps((rows) => replaceAt(rows, index, { instruction: event.target.value }))}
                  rows={2}
                />
                <Input
                  aria-label={`Step ${index + 1} note`}
                  placeholder="Note (optional)"
                  value={step.note}
                  onChange={(event) => setSteps((rows) => replaceAt(rows, index, { note: event.target.value }))}
                />
              </div>

              <RowControls index={index} count={steps.length} onMove={(from, to) => setSteps((rows) => move(rows, from, to))} onRemove={(i) => setSteps((rows) => rows.filter((_, r) => r !== i))} />
            </li>
          ))}
        </ol>
      </section>

      <Separator className="my-10" />

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Tastes better the next day." />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <div className="flex items-center gap-3">
          <Switch id="published" checked={published} onCheckedChange={setPublished} />
          <Label htmlFor="published">Publish immediately</Label>
        </div>

        <Button type="submit" className="ml-auto" disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : null}
          {isPending ? "Saving…" : "Save recipe"}
        </Button>
      </div>
    </form>
  );
}
