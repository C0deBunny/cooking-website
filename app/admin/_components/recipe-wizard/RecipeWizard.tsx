"use client";

// import lib
import { useActionState, useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import { detailsSchema, ingredientsSchema, stepsSchema } from "@/lib/recipes/schema";
import { EMPTY_DRAFT, toPayload, toPreview } from "./draft";

// import actions
import { saveRecipe } from "@/lib/recipes/actions";

// import components
import DetailsPanel from "./DetailsPanel";
import IngredientsPanel from "./IngredientsPanel";
import PreviewRail from "./PreviewRail";
import ReviewPanel from "./ReviewPanel";
import Stepper, { STEPS } from "./Stepper";
import StepsPanel from "./StepsPanel";
import { Button } from "@/components/ui/button";

// import types
import type { Draft } from "./draft";
import type { RecipeFormState } from "@/lib/recipes/schema";

/**
 * The recipe creator: four steps over one submit.
 *
 * Lives in app/admin/_components/ rather than under app/admin/create/ because editing will reuse
 * it from a sibling route — the same reason the form it replaces lived here.
 *
 * **The step lives in client state, not in the URL.** A recipe cannot be saved in pieces —
 * `save_recipe()` writes the whole thing in one transaction — so real routes per step would
 * advertise a durability the write path does not have, and `?step=` would need its own Suspense
 * boundary under `cacheComponents` for the same reason `usePathname` already does. The cost,
 * accepted: no deep link to a step, and the browser Back button leaves the wizard rather than
 * stepping back through it (decision 1).
 *
 * **Nothing is saved until Review, and a refresh loses all of it.** No autosave, no
 * `beforeunload`, no localStorage — an explicit scope cut, logged in docs/known-issues.md
 * (decisions 13 and 14).
 */
export default function RecipeWizard() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);

  // Here rather than in ReviewPanel so a returned error outlives that panel: a slug collision
  // sends the user back to Details, which unmounts Review and would take the message with it.
  const [state, formAction, isPending] = useActionState<RecipeFormState, FormData>(saveRecipe, {});

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  // Parsed from the payload rather than from the draft, so each ✓ is checking the object that
  // will actually be submitted rather than something adjacent to it.
  const payload = useMemo(() => toPayload(draft), [draft]);
  const preview = useMemo(() => toPreview(draft), [draft]);

  const complete = useMemo(() => [detailsSchema.safeParse(payload).success, ingredientsSchema.safeParse(payload).success, stepsSchema.safeParse(payload).success], [payload]);

  const allComplete = complete.every(Boolean);
  const missing = STEPS.slice(0, 3)
    .map((entry, index) => (complete[index] ? null : entry.title))
    .filter((title): title is string => title !== null);

  function go(next: number) {
    if (next === 3 && !allComplete) return;
    setStep(next);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Recipe Creator</h1>
        <p className="text-sm text-muted-foreground">Add a recipe to the site.</p>
      </header>

      <Stepper step={step} complete={complete} onGo={go} />

      {step !== 3 ? (
        allComplete ? (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-difficulty-easy/30 bg-difficulty-easy-bg px-4 py-3 text-sm text-difficulty-easy">
            <Check className="size-4 shrink-0" />
            <span className="flex-1">All three sections are filled in.</span>
            <Button type="button" size="sm" onClick={() => go(3)}>
              Go to Review &amp; Publish
            </Button>
          </div>
        ) : (
          <p className="mb-5 flex items-center gap-3 rounded-xl border border-difficulty-medium/30 bg-difficulty-medium-bg px-4 py-3 text-sm text-difficulty-medium">
            <Lock className="size-4 shrink-0" />
            <span>
              Review &amp; Publish unlocks once <b>{missing.join(", ")}</b> {missing.length > 1 ? "are" : "is"} complete.
            </span>
          </p>
        )
      ) : null}

      {/* The preview rail is a grid column on steps 1–3 and gone entirely on Review, where the
          article is rendered full width underneath the checklist instead. */}
      <div className={step === 3 ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(19rem,0.95fr)]"}>
        <div className="min-w-0">
          {step === 0 ? <DetailsPanel draft={draft} takenSlug={state.takenSlug} onPatch={patch} onNext={() => go(1)} /> : null}
          {step === 1 ? <IngredientsPanel draft={draft} onPatch={patch} onBack={() => go(0)} onNext={() => go(2)} /> : null}
          {step === 2 ? <StepsPanel draft={draft} onPatch={patch} onBack={() => go(1)} onNext={() => go(3)} nextDisabled={!allComplete} /> : null}
          {step === 3 ? (
            <ReviewPanel
              draft={draft}
              payload={payload}
              preview={preview}
              state={state}
              formAction={formAction}
              isPending={isPending}
              onPatch={patch}
              onBack={() => go(2)}
              onBackToDetails={() => go(0)}
            />
          ) : null}
        </div>

        {step !== 3 ? <PreviewRail recipe={preview} step={step} /> : null}
      </div>
    </div>
  );
}
