// import lib
import { Check, CircleAlert, Save } from "lucide-react";
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
export default function ReviewPanel({ draft, payload, preview, state, formAction, isPending, onPatch, onBack, onBackToDetails }: Props) {
  const slug = slugify(draft.title);
  const ingredientCount = preview.ingredients.length;
  const stepCount = preview.steps.length;

  const times = [draft.prep_minutes && `${draft.prep_minutes} min prep`, draft.cook_minutes && `${draft.cook_minutes} min cooking`].filter(Boolean).join(" + ") || "no times recorded";

  const checklist = [
    { label: "Details", value: [draft.title.trim(), preview.difficulty ?? "no difficulty", times].join(" · ") },
    { label: "Ingredients", value: `${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}${draft.servings ? `, serves ${draft.servings}` : ""}` },
    { label: "Steps", value: `${stepCount} step${stepCount === 1 ? "" : "s"}` },
  ];

  return (
    <>
      {state.error ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          <span className="flex-1">{state.error}</span>

          {/* A collision has no fix on this panel — the address follows the title and there is no
              field for it, on purpose (decision 11). So the only useful control is a way back to
              the thing that has to change. */}
          {state.takenSlug === slug ? (
            <Button type="button" variant="outline" size="sm" onClick={onBackToDetails}>
              Back to Details
            </Button>
          ) : null}
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

            <PanelNav onBack={onBack}>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : <Save />}
                {isPending ? "Saving…" : "Save recipe"}
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
