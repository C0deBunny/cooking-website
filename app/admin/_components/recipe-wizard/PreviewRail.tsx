// import lib
import { useEffect, useRef } from "react";

// import components
import RecipeArticle from "@/components/shared/RecipeArticle";
import { Card } from "@/components/ui/card";

// import types
import type { RecipeView } from "@/types/recipes";

/**
 * The live preview, which is the real `RecipeArticle` and not a compact stand-in.
 *
 * With no images anywhere in this project a recipe's entire appearance is text, which is exactly
 * what a preview can show faithfully — and a second renderer is the drift problem in its purest
 * form: change the layout once and the preview starts lying about the page it previews
 * (decisions 7 and 15).
 *
 * **Not rendered below 1024px.** `/admin` is already desktop-first — `AdminSidebar` is
 * `collapsible="none"` with a fixed 16rem rail that never collapses — so there is no narrow
 * layout to fit this into, and a `Sheet` would be a second rendering path to maintain for a
 * screen used at a desk.
 *
 * The mockup also dimmed the two sections that did not match the current step. That was flagged
 * as adjustable, and it is dropped: dimming two thirds of a preview reads as broken rather than
 * focused, and doing it would mean either giving the shared article a wizard-shaped prop or
 * styling its internals from out here. Scrolling to the section says the same thing and costs
 * neither.
 */
export default function PreviewRail({ recipe, step }: { recipe: RecipeView; step: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // The ids come from RecipeArticle's own aria-labelledby, so they are part of its markup
    // contract rather than something reached into. Step 0 is the header, which is the top.
    const target = step === 1 ? container.querySelector("#ingredients-heading") : step === 2 ? container.querySelector("#steps-heading") : null;

    container.scrollTo({ top: target instanceof HTMLElement ? Math.max(0, target.offsetTop - 16) : 0, behavior: "smooth" });
  }, [step]);

  return (
    <Card className="sticky top-6 hidden gap-0 py-0 lg:block">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Live preview</p>
        <p className="text-xs text-muted-foreground">This updates as you fill in the form.</p>
      </div>

      {/* relative, because the scroll maths above reads offsetTop against this container. */}
      <div ref={scrollRef} className="relative max-h-[38rem] overflow-y-auto">
        <RecipeArticle recipe={recipe} placeholders />
      </div>
    </Card>
  );
}
