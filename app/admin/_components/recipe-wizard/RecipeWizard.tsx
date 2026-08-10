"use client";

// import lib
import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import { detailsSchema, ingredientsSchema, stepsSchema } from "@/lib/recipes/schema";
import { slugify } from "@/lib/utils";
import { emptyDraft, replaceById, toPayload, toPreview } from "./draft";

// import actions
import { checkSlugTaken, saveRecipe } from "@/lib/recipes/actions";

// import components
import DetailsPanel from "./DetailsPanel";
import IngredientsPanel from "./IngredientsPanel";
import PreviewRail from "./PreviewRail";
import ReviewPanel from "./ReviewPanel";
import Stepper, { STEPS } from "./Stepper";
import StepsPanel from "./StepsPanel";
import { Button } from "@/components/ui/button";

// import types
import type { Draft, StepImage } from "./draft";
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

/**
 * Long enough that typing a title is one check rather than thirty, short enough that the answer is
 * there before anyone reaches Review. The delay is why nothing may *depend* on the check having
 * run — for most of the time the title is being typed, it hasn't.
 */
const SLUG_CHECK_DELAY_MS = 400;

export default function RecipeWizard() {
  // Lazy, because `emptyDraft()` mints a uuid for its first step — the eager form would call it on
  // every render and throw the row's identity away each time.
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [step, setStep] = useState(0);

  // Here rather than in ReviewPanel so a returned error outlives that panel: a slug collision
  // sends the user back to Details, which unmounts Review and would take the message with it.
  const [state, formAction, isPending] = useActionState<RecipeFormState, FormData>(saveRecipe, {});

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  /* ---------------------------------------------------------------------------------------- *
   * The two photo write-backs
   *
   * Both are here rather than in the panels, and both take the functional form of setDraft, for
   * one reason: an upload resolves seconds after it starts. A panel computing its next array from
   * a closed-over `draft.steps` — which is what every keystroke handler correctly does — would be
   * writing against a snapshot the user has since edited.
   *
   * The step write-back addresses the row by `id`, never by index. Start an upload on step 3,
   * click ↑ on step 4, and a positional write lands the finished path on the wrong step and leaves
   * the right one busy forever, with Publish disabled and nothing on screen saying why. A row that
   * was deleted meanwhile matches nothing and the patch is dropped, which is correct: its state
   * went with it (decision 31).
   * ---------------------------------------------------------------------------------------- */

  function setCover(image: StepImage) {
    setDraft((current) => ({ ...current, cover: image }));
  }

  function setStepImage(id: string, image: StepImage) {
    setDraft((current) => ({ ...current, steps: replaceById(current.steps, id, { image }) }));
  }

  // Parsed from the payload rather than from the draft, so each ✓ is checking the object that
  // will actually be submitted rather than something adjacent to it.
  const payload = useMemo(() => toPayload(draft), [draft]);
  const preview = useMemo(() => toPreview(draft), [draft]);

  const complete = useMemo(() => [detailsSchema.safeParse(payload).success, ingredientsSchema.safeParse(payload).success, stepsSchema.safeParse(payload).success], [payload]);

  const allComplete = complete.every(Boolean);

  /* ---------------------------------------------------------------------------------------- *
   * Photos in flight, and photos that failed
   *
   * Derived, like everything else on this component — there is no new `useState` for either, which
   * is the whole point of putting the state on the row (decision 18).
   *
   * Neither one joins `complete[]`. Each ✓ is that step's own `safeParse` and nothing else, for
   * exactly the reason spelled out for `slugTaken` below: an upload in flight is an asynchronous
   * fact about the world, not a property of the data's shape, and folding it in would make a step
   * tick and un-tick as photos land. They block the submit instead (decision 10).
   * ---------------------------------------------------------------------------------------- */

  const uploading = useMemo(() => draft.cover?.status === "busy" || draft.steps.some((entry) => entry.image?.status === "busy"), [draft]);

  const failedPhotos = useMemo(
    () => [
      ...(draft.cover?.status === "failed" ? [{ label: "The cover photo", reason: draft.cover.reason }] : []),
      ...draft.steps.flatMap((entry, index) => (entry.image?.status === "failed" ? [{ label: `The photo on step ${index + 1}`, reason: entry.image.reason }] : [])),
    ],
    [draft]
  );

  /* ---------------------------------------------------------------------------------------- *
   * The live address check
   *
   * A taken address is deliberately *not* part of `complete` above. Each ✓ is that step's own
   * `safeParse` and nothing else, and a taken slug parses perfectly — it is a valid slug that
   * happens to be spoken for. Availability is a fact about the database, not about the shape of
   * the data, and it arrives asynchronously; folding it into the tick would make Details flicker
   * on a network round trip, which is the exact drift that rule exists to prevent.
   *
   * So it blocks the submit instead, and Review stays reachable. The lock banner says Review
   * unlocks "once Details is complete" — and Details *is* complete, so refusing entry there would
   * send the user back to hunt for an empty field that doesn't exist.
   * ---------------------------------------------------------------------------------------- */

  const slug = useMemo(() => slugify(draft.title), [draft.title]);

  // Holds the slug found taken rather than a boolean, mirroring `state.takenSlug`, so the warning
  // clears itself: one keystroke in the title derives a different slug and the two stop matching.
  const [liveTakenSlug, setLiveTakenSlug] = useState<string | null>(null);

  useEffect(() => {
    // No slug at all is decision 10's case, which the address line already explains. Nothing to ask
    // the database, and asking would fail the schema's `min(1)` anyway.
    //
    // Left over from a previous title rather than cleared, because clearing it here would be a
    // synchronous setState in an effect and it buys nothing: both readers below compare against
    // the slug the title derives *now*, and no leftover value can equal "".
    if (!slug) return;

    let current = true;

    const timer = setTimeout(() => {
      checkSlugTaken(slug)
        .then((taken) => {
          if (current) setLiveTakenSlug(taken ? slug : null);
        })
        // A failed round trip is "don't know", and "don't know" is never allowed to block. The
        // action swallows its own errors for this reason; this catches the network on top of it.
        .catch(() => {
          if (current) setLiveTakenSlug(null);
        });
    }, SLUG_CHECK_DELAY_MS);

    // Covers both jobs at once: cancels the pending debounce, and drops the answer to a title that
    // is no longer on screen, so a slow response for an old slug cannot land on a new one.
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [slug]);

  // Either source counts, and the live one never overrides the other: a 23505 that has already
  // come back is a fact, while the check is the thing that can be stale or have never run.
  const takenSlug = liveTakenSlug ?? state.takenSlug;
  const slugTaken = !!slug && takenSlug === slug;
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
          article is the panel: the whole width, on the page's own background, under a sticky
          publish bar. A rail there would mean the same slot showing a preview for three steps and
          then controls on the fourth (decision 2).

          This single-column div is also the publish bar's containing block, which is what gives the
          bar its travel — it is as tall as the whole article. Adding `overflow` or a transform
          anywhere from here up kills the sticky silently. */}
      <div className={step === 3 ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(19rem,0.95fr)]"}>
        <div className="min-w-0">
          {step === 0 ? <DetailsPanel draft={draft} takenSlug={takenSlug} onPatch={patch} onCover={setCover} onNext={() => go(1)} /> : null}
          {step === 1 ? <IngredientsPanel draft={draft} onPatch={patch} onBack={() => go(0)} onNext={() => go(2)} /> : null}
          {step === 2 ? <StepsPanel draft={draft} onPatch={patch} onStepImage={setStepImage} onBack={() => go(1)} onNext={() => go(3)} nextDisabled={!allComplete} /> : null}
          {step === 3 ? (
            <ReviewPanel
              draft={draft}
              payload={payload}
              preview={preview}
              state={state}
              slugTaken={slugTaken}
              uploading={uploading}
              failedPhotos={failedPhotos}
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
