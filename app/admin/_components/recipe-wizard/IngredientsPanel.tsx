// import lib
import { Plus } from "lucide-react";
import { amountChars, digitsOnly, EMPTY_INGREDIENT, move, replaceAt } from "./draft";

// import components
import PanelNav from "./PanelNav";
import RowControls from "./RowControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// import types
import type { Draft, IngredientDraft } from "./draft";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * Servings lives here rather than on Details because the amounts below are relative to it —
 * "400 ml kokosmelk" only means something once you know it serves four (decision 6).
 */
export default function IngredientsPanel({ draft, onPatch, onBack, onNext }: Props) {
  const setRows = (rows: IngredientDraft[]) => onPatch({ ingredients: rows });

  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Ingredients</CardTitle>
        <CardDescription>At least one. Amount and unit are optional — &ldquo;salt, to taste&rdquo; has neither.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="max-w-64 space-y-2">
          <Label htmlFor="servings">Servings</Label>
          <div className="relative">
            <Input id="servings" inputMode="numeric" value={draft.servings} placeholder="4" onChange={(event) => onPatch({ servings: digitsOnly(event.target.value) })} className="pr-16" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">people</span>
          </div>
          <p className="text-xs text-muted-foreground">The amounts below make this many portions.</p>
        </div>

        <div className="mt-7 grid grid-cols-[5rem_5.5rem_minmax(0,1fr)_auto] gap-2 px-0.5 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>Amount</span>
          <span>Unit</span>
          <span>Ingredient</span>
          <span className="w-26" />
        </div>

        <ul>
          {draft.ingredients.map((ingredient, index) => (
            <li key={index} className="mb-2 grid grid-cols-[5rem_5.5rem_minmax(0,1fr)_auto] items-center gap-2">
              {/* amountChars, not digitsOnly: this one takes a comma, a dot or a fraction, because
                  "0,5" and "1/2" are both how a recipe gets written. See decision 5. */}
              <Input
                inputMode="decimal"
                aria-label={`Amount for ingredient ${index + 1}`}
                value={ingredient.amount}
                placeholder="4"
                onChange={(event) => setRows(replaceAt(draft.ingredients, index, { amount: amountChars(event.target.value) }))}
              />
              <Input
                aria-label={`Unit for ingredient ${index + 1}`}
                value={ingredient.unit}
                placeholder="ml"
                onChange={(event) => setRows(replaceAt(draft.ingredients, index, { unit: event.target.value }))}
              />
              <Input
                aria-label={`Ingredient ${index + 1}`}
                value={ingredient.name}
                placeholder="bakbananen"
                onChange={(event) => setRows(replaceAt(draft.ingredients, index, { name: event.target.value }))}
              />

              <RowControls
                index={index}
                count={draft.ingredients.length}
                label="ingredient"
                onMove={(from, to) => setRows(move(draft.ingredients, from, to))}
                onRemove={(i) => setRows(draft.ingredients.filter((_, r) => r !== i))}
              />
            </li>
          ))}
        </ul>

        {/* The one thing a sanitiser cannot remove. An empty row is reachable — the Add button
            makes one — and `ingredientsSchema` rejects it, so the step un-ticks and Review
            re-locks. Same reasoning as the unsluggable title on Details (decision 10): the
            invalid state that cannot be made untypeable gets explained instead. */}
        {draft.ingredients.some((ingredient) => !ingredient.name.trim()) ? (
          <p className="mt-3 text-xs text-difficulty-medium">Every ingredient needs a name. Fill the empty row in, or remove it with ✕.</p>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">The order here is the order on the page. Use the arrows to rearrange.</p>

        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setRows([...draft.ingredients, { ...EMPTY_INGREDIENT }])}>
          <Plus />
          Add ingredient
        </Button>

        <PanelNav onBack={onBack} onNext={onNext} nextLabel="Next: Steps" />
      </CardContent>
    </Card>
  );
}
