// import lib
import { ArrowLeft, ArrowRight } from "lucide-react";

// import components
import { Button } from "@/components/ui/button";

/**
 * The Back / Next footer, identical on steps 1–3. **Review does not use it** — its Back and Save
 * moved into that panel's sticky publish bar, so this renders on three panels, not four.
 *
 * `type="button"` everywhere is not incidental, and the reason followed Back into the bar rather
 * than disappearing with it. Review wraps the wizard's only real `<form>`, and an unspecified
 * button inside a form defaults to `type="submit"` — so Review's Back button would save the recipe.
 * Steps 1–3 have no form at all (decision 12), which is what stops Enter in a text field from
 * submitting; the attribute stays here against a panel that later grows one.
 *
 * `children` is the slot Review used to hang its Save button in. Nothing passes it now. It is kept
 * as the generic "extra control beside Next" slot rather than deleted, so a fourth panel with its
 * own action needs no signature change; delete it if that never arrives.
 */
export default function PanelNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  children,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-5">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {children}

        {onNext ? (
          <Button type="button" onClick={onNext} disabled={nextDisabled}>
            {nextLabel}
            <ArrowRight />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
