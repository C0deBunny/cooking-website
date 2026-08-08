// import lib
import { Plus } from "lucide-react";
import { move, newStep, replaceAt } from "./draft";

// import components
import ImageField from "./ImageField";
import PanelNav from "./PanelNav";
import RowControls from "./RowControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// import types
import type { Draft, StepDraft, StepImage } from "./draft";

type Props = {
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;

  /**
   * Separate from `onPatch`, and addressed by id rather than by index, because an upload lands
   * seconds after it starts — long enough for the row to have moved or gone. See the write-backs
   * in `RecipeWizard`; the keystroke handlers below stay positional, which is correct for them.
   */
  onStepImage: (id: string, image: StepImage) => void;

  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
};

/**
 * The numbers beside each step are `index + 1` and are never stored by the form. `save_recipe()`
 * derives `step_number` from array position with `with ordinality`, so moving a step renumbers
 * the whole method for free and no two rows can ever claim the same position.
 */
export default function StepsPanel({ draft, onPatch, onStepImage, onBack, onNext, nextDisabled }: Props) {
  const setRows = (rows: StepDraft[]) => onPatch({ steps: rows });

  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Method</CardTitle>
        <CardDescription>At least one step. The numbering follows the order here.</CardDescription>
      </CardHeader>

      <CardContent>
        <ol>
          {/* Keyed by the row's own id, not by index. Positional keys make React reuse the wrong
              DOM on a reorder, which for a row holding a thumbnail is visible. */}
          {draft.steps.map((step, index) => (
            <li key={step.id} className="mb-4 flex items-start gap-3">
              <span aria-hidden className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full bg-foreground/5 text-sm font-semibold tabular-nums">
                {index + 1}
              </span>

              <div className="flex-1 space-y-2">
                <Textarea
                  rows={2}
                  aria-label={`Step ${index + 1}`}
                  value={step.instruction}
                  placeholder="What happens in this step?"
                  onChange={(event) => setRows(replaceAt(draft.steps, index, { instruction: event.target.value }))}
                />
                <Input
                  aria-label={`Note for step ${index + 1}`}
                  value={step.note}
                  placeholder="Note (optional) — a warning that belongs to this step"
                  onChange={(event) => setRows(replaceAt(draft.steps, index, { note: event.target.value }))}
                />

                {/* Inside this column rather than a fourth element beside RowControls, so it
                    inherits whatever responsive behaviour the column already has. */}
                <ImageField value={step.image} onChange={(image) => onStepImage(step.id, image)} variant="step" label={`Photo for step ${index + 1}`} />
              </div>

              <div className="mt-1.5">
                <RowControls
                  index={index}
                  count={draft.steps.length}
                  label="step"
                  onMove={(from, to) => setRows(move(draft.steps, from, to))}
                  onRemove={(i) => setRows(draft.steps.filter((_, r) => r !== i))}
                />
              </div>
            </li>
          ))}
        </ol>

        {/* See the matching note in IngredientsPanel: an empty row is reachable and un-ticks the
            step, so it is explained rather than left to be guessed at. */}
        {draft.steps.some((step) => !step.instruction.trim()) ? (
          <p className="mb-3 text-xs text-difficulty-medium">Every step needs an instruction. Fill the empty step in, or remove it with ✕.</p>
        ) : null}

        {/* newStep(), not a spread of a shared constant — every row needs its own id. */}
        <Button type="button" variant="outline" size="sm" onClick={() => setRows([...draft.steps, newStep()])}>
          <Plus />
          Add step
        </Button>

        <PanelNav onBack={onBack} onNext={onNext} nextLabel="Next: Review & Publish" nextDisabled={nextDisabled} />
      </CardContent>
    </Card>
  );
}
