// import lib
import { ArrowDown, ArrowUp, X } from "lucide-react";

// import components
import { Button } from "@/components/ui/button";

/**
 * Up · down · remove, shared by the ingredient and step lists so the two behave identically.
 *
 * Reordering is free here: array position *is* the stored order, so moving a row renumbers
 * nothing. `save_recipe()` deletes and re-inserts each child set on every save and takes the
 * position from array order, which is also why the non-deferrable unique constraint on
 * `(recipe_id, sort_order)` never fires — see docs/known-issues.md.
 *
 * Remove is disabled at one row rather than allowing zero, because both schemas require at least
 * one and an empty list would un-tick the step with no way back except "Add".
 */
export default function RowControls({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${label} ${index + 1}`}
        disabled={count === 1}
        onClick={() => onRemove(index)}
        className="hover:bg-destructive/10 hover:text-destructive"
      >
        <X />
      </Button>
    </div>
  );
}
