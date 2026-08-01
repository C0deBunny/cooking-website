// import lib
import { ArrowLeft, ArrowRight } from "lucide-react";

// import components
import { Button } from "@/components/ui/button";

/**
 * The Back / Next footer, identical on all four panels.
 *
 * `type="button"` everywhere is not incidental. The Review panel wraps a real `<form>`, and an
 * unspecified button inside a form defaults to `type="submit"` — so Review's Back button would
 * save the recipe. Steps 1–3 have no form at all (decision 12), which is what stops Enter in a
 * text field from submitting, but the attribute has to be right on Review regardless.
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
