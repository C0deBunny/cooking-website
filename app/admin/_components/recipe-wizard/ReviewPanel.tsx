// import lib
import { Check, CircleAlert, Save } from "lucide-react";
import { slugTakenMessage } from "@/lib/recipes/schema";
import { slugify } from "@/lib/utils";

// import components
import PanelNav from "./PanelNav";
import RecipeArticle from "@/components/shared/RecipeArticle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

// import types
import type { Draft } from "./draft";
import type { RecipeFormState, RecipeInput } from "@/lib/recipes/schema";
import type { RecipeView } from "@/types/recipes";

type Props = {
  draft: Draft;
  payload: RecipeInput;
  preview: RecipeView;
  state: RecipeFormState;
  slugTaken: boolean;

  /** Any photo still uploading. Blocks the save, because the payload would omit it. */
  uploading: boolean;

  /** Photos that failed, already carrying written messages rather than Postgres strings. */
  failedPhotos: { label: string; reason: string }[];

  formAction: (formData: FormData) => void;
  isPending: boolean;
  onPatch: (patch: Partial<Draft>) => void;
  onBack: () => void;
  onBackToDetails: () => void;
};

/**
 * The only `<form>` in the wizard, and the only place the recipe is saved.
 *
 * **Steps 1–3 deliberately contain no form element.** Inside a form, Enter in any text input
 * triggers implicit submission against the first submit button — so one wrapping form would let
 * a habitual Enter after typing the title fire `saveRecipe` with a single field filled. Removing
 * the element removes the mechanism rather than suppressing it, and it costs nothing: the hidden
 * `payload` field reads React state, so the inputs living outside the form is irrelevant to what
 * gets submitted (decision 12).
 *
 * `useActionState` itself lives one level up in `RecipeWizard`, not here, because a returned
 * error has to outlive this panel — a slug collision sends you back to Details to change the
 * title, which unmounts this component and would take the error with it.
 *
 * There is no Save Draft button either. The publish switch below already expresses "save this as
 * a draft", and a save-and-stay would have to thread the returned id back into the draft or the
 * second click would insert a second recipe (decision 13).
 */
export default function ReviewPanel({ draft, payload, preview, state, slugTaken, uploading, failedPhotos, formAction, isPending, onPatch, onBack, onBackToDetails }: Props) {
  const slug = slugify(draft.title);
  const ingredientCount = preview.ingredients.length;
  const stepCount = preview.steps.length;

  const times = [draft.prep_minutes && `${draft.prep_minutes} min prep`, draft.cook_minutes && `${draft.cook_minutes} min cooking`].filter(Boolean).join(" + ") || "no times recorded";

  const checklist = [
    { label: "Details", value: [draft.title.trim(), preview.difficulty ?? "no difficulty", times].join(" · ") },
    { label: "Ingredients", value: `${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}${draft.servings ? `, serves ${draft.servings}` : ""}` },
    { label: "Steps", value: `${stepCount} step${stepCount === 1 ? "" : "s"}` },
  ];

  // A collision the live check caught has no `state.error` behind it — nothing has been submitted
  // yet. Both paths report it through the same helper so the wording cannot drift.
  const error = state.error ?? (slugTaken ? slugTakenMessage(slug) : null);

  return (
    <>
      {error ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>

          {/* A collision has no fix on this panel — the address follows the title and there is no
              field for it, on purpose (decision 11). So the only useful control is a way back to
              the thing that has to change. */}
          {slugTaken ? (
            <Button type="button" variant="outline" size="sm" onClick={onBackToDetails}>
              Back to Details
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Failed photos land in the same alert treatment, with a way back to where the field is —
          mirroring the slug collision above rather than inventing a second reporting idiom
          (decision 25). The checklist below is untouched and its green Check stays a constant:
          each step genuinely parses, so the step *is* complete and only its photo failed.

          Saving is still allowed. A failed photo is a photo the recipe will not have, which is a
          state worth reporting and not one worth refusing — unlike an upload still in flight,
          which would be silently dropped from a payload built a moment too early. */}
      {failedPhotos.length > 0 ? (
        <div role="alert" className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 space-y-1">
            {failedPhotos.map((photo) => (
              <p key={photo.label}>
                <b>{photo.label}</b> did not upload. {photo.reason}
              </p>
            ))}
            <p className="text-destructive/80">Saving now publishes the recipe without them.</p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            Back to Method
          </Button>
        </div>
      ) : null}

      <Card className="py-6">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Review &amp; publish</CardTitle>
          <CardDescription>Everything below is written in one save.</CardDescription>
        </CardHeader>

        <CardContent>
          {/* No DifficultyBadge in the checklist — the article directly below already shows it. */}
          <ul className="grid gap-2.5">
            {checklist.map((entry) => (
              <li key={entry.label} className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3">
                <Check className="mt-0.5 size-4 shrink-0 text-difficulty-easy" />
                <div>
                  <p className="text-sm font-semibold">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{entry.value}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* The form starts here and wraps nothing but the switch, the payload and Save. */}
          <form action={formAction}>
            <input type="hidden" name="payload" value={JSON.stringify(payload)} />

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-foreground/5 p-4">
              <Switch id="published" checked={draft.published} onCheckedChange={(checked) => onPatch({ published: checked })} className="mt-0.5" />
              <div>
                <Label htmlFor="published" className="font-semibold">
                  Publish immediately
                </Label>
                <p className="text-xs text-muted-foreground">Off saves it as a draft, visible only to you at /admin/preview/{slug || "…"}.</p>
              </div>
            </div>

            {/* Disabled on a known collision, because the save is certain to be refused — pressing
                it buys a round trip and the same message in red. Only a *known* one: the check
                answers "free" whenever it could not find out, so an unreachable server or a slow
                answer leaves this enabled and the 23505 branch catches what gets through. */}
            {/* Also disabled while a photo is uploading, and for a different reason than the
                collision: the payload is built from the draft, and a path that has not arrived yet
                is simply absent from it — so a save mid-upload publishes a recipe missing a photo
                that was seconds from being ready, silently. Deliberately not folded into the
                stepper's ✓ marks, which are each that step's own safeParse and nothing else
                (decision 10). */}
            <PanelNav onBack={onBack}>
              <Button type="submit" disabled={isPending || slugTaken || uploading}>
                {isPending || uploading ? <Spinner /> : <Save />}
                {isPending ? "Saving…" : uploading ? "Waiting for a photo…" : "Save recipe"}
              </Button>
            </PanelNav>
          </form>
        </CardContent>
      </Card>

      {/* The real article at full width, rather than a summary that would drift from the page it
          claims to preview. Same component the two recipe routes render. */}
      <Card className="mt-5 py-0">
        <RecipeArticle recipe={preview} placeholders align="start" />
      </Card>
    </>
  );
}
