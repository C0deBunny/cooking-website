// import lib
import { ArrowLeft, CircleAlert, Save, TriangleAlert } from "lucide-react";
import { slugTakenMessage } from "@/lib/recipes/schema";
import { slugify } from "@/lib/utils";

// import components
import RecipeArticle from "@/components/shared/RecipeArticle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
 * **The form still wraps only the toggle, the payload and Save**, which is why the publish bar
 * below is a plain flex row with the form nested inside it rather than a form of its own. Back
 * stays outside it and keeps its explicit `type="button"` regardless.
 *
 * `useActionState` itself lives one level up in `RecipeWizard`, not here, because a returned
 * error has to outlive this panel — a slug collision sends you back to Details to change the
 * title, which unmounts this component and would take the error with it.
 *
 * There is no Save Draft button either. The `Draft ▏Publish now` toggle below already expresses
 * "save this as a draft", and a save-and-stay would have to thread the returned id back into the
 * draft or the second click would insert a second recipe (decision 13).
 *
 * **There is no completeness checklist here, on purpose.** It used to restate the Stepper's three
 * ✓ marks a second time while the article below restated the content a third; `Stepper.tsx` has
 * always claimed to be "the only place completeness is shown" and deleting the list is what made
 * that true. Losing the "3 ingredients, serves 8" counts is safe: `ingredientsSchema` and
 * `stepsSchema` both carry `.min(1)` and Review is locked until all three parse, so the article
 * can never be empty here. The list is the count. Don't reintroduce it — see
 * `docs/plans/review-publish-revamp/decisions.md`, decisions 2 and 6.
 */
export default function ReviewPanel({ draft, payload, preview, state, slugTaken, uploading, failedPhotos, formAction, isPending, onPatch, onBack, onBackToDetails }: Props) {
  const slug = slugify(draft.title);

  // The bar's reason to exist. It absorbs the old publish switch's helper text and upgrades it:
  // the toggle's consequence becomes something you see rather than something a sentence describes.
  //
  // The label reads `Saves to`, never "permanent address" — the slug follows the title *forever,
  // including on edit*, where a rename changes the live URL and `updateTag("recipes")` 404s the old
  // one immediately. "Permanent" would assert the opposite of the one thing about slugs that
  // actually bites (decision 3).
  const destination = `${draft.published ? "/recipes" : "/admin/preview"}/${slug || "…"}`;

  // A collision the live check caught has no `state.error` behind it — nothing has been submitted
  // yet. Both paths report it through the same helper so the wording cannot drift.
  const error = state.error ?? (slugTaken ? slugTakenMessage(slug) : null);

  // Where the failed-photo alert's button goes, read off the draft rather than off `failedPhotos`'
  // written labels — the cover field lives on Details and every step photo on Method, so one fixed
  // destination is wrong for half the cases. A mixed failure goes to Details because it is the
  // earlier panel: fix the cover there and the ordinary Next walks forward to Method.
  const coverFailed = draft.cover?.status === "failed";
  const backToPhoto = coverFailed ? { label: "Back to Details", onClick: onBackToDetails } : { label: "Back to Method", onClick: onBack };

  return (
    <>
      {/* The publish bar. It pins because the article underneath it is a whole recipe page tall —
          Save has to be reachable from wherever you finished reading the thing you are deciding
          whether to publish.

          `top-16` and `z-30` are both derived, not picked: `Navbar` is `sticky top-0 z-40 h-16` on
          every route including admin, and its own comment names the convention — *"Change it and
          grep top-16."* So the bar clears the navbar's 64px and sits below it in z, which is what
          lets the article scroll under both.

          Sticky only from `lg`. `/admin` is desktop-first by design (`AdminSidebar` is
          `collapsible="none"` with a rail that never collapses), and at phone widths this row wraps
          into a tall block that would eat half the viewport if it were pinned. Below `lg` it is an
          ordinary header instead — which is also why `z-30` is `lg:`-prefixed, since z-index does
          nothing to a static element.

          Nothing above this in the tree may gain `overflow` or a transform. Both create a new
          containing block and sticky silently stops working — `admin/layout.tsx` avoids
          `SidebarInset` partly for this reason. */}
      <div className="mb-5 lg:sticky lg:top-16 lg:z-30">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            {/* Leftmost, where `PanelNav` has trained the hand on the other three panels, and
                `type="button"` because it sits on the panel that owns the wizard's only form.
                During a slug clash this reads directly above the alert's own `Back to Details` —
                two back-controls, two destinations — which is accepted so that Back means the same
                thing on all four panels (decision 5). */}
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft />
              Back
            </Button>

            {/* `border-l` and an explicit height, copying the navbar's dividers — `Separator`'s own
                `data-vertical:w-px` targets a `data-vertical` attribute that radix never sets, so a
                vertical separator with no border renders 0px wide. */}
            <Separator orientation="vertical" className="h-8 border-l border-border" />

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Saves to</p>
              <p className="truncate font-mono text-sm font-semibold">{destination}</p>
            </div>

            {/* The count only, with no anchor to the detail below — deliberately inert. The obvious
                improvement, scrolling to the alert, has to clear *two* stacked sticky elements (the
                navbar and this bar), so it needs a `scroll-mt` of roughly their combined height:
                a magic number that rots silently the first time this bar's height changes. A short
                hunt upward beats a hidden alert that looks like it worked (decision 7).

                Amber rather than destructive, and bounded to one line, because the failure it
                reports does not block the save — see the alert in the flow below. */}
            {failedPhotos.length > 0 ? (
              <p className="flex items-center gap-1.5 rounded-full border border-difficulty-medium/30 bg-difficulty-medium-bg px-2.5 py-1 text-xs font-semibold text-difficulty-medium">
                <TriangleAlert className="size-3.5 shrink-0" />
                {failedPhotos.length} photo{failedPhotos.length === 1 ? "" : "s"} missing
              </p>
            ) : null}

            {/* The form starts here and wraps nothing but the toggle, the payload and Save. */}
            <form action={formAction} className="flex items-center gap-3">
              <input type="hidden" name="payload" value={JSON.stringify(payload)} />

              {/* A segmented pair rather than a `Switch`: a lone switch's state is only readable if
                  you already know which way is "on", and this is the last screen before a live URL
                  exists.

                  **The `value &&` guard is load-bearing.** Radix `type="single"` permits
                  deselecting the active item, which reports `""` — without the guard `published`
                  would take a third, meaningless state. No submit guard is needed on the other
                  hand: radix already sets `type="button"` on Toggle's root, so neither item can
                  submit the form it sits in (decision 9).

                  **The track is styled rather than stock**, and for the same reason the control
                  exists: `ToggleGroupItem`'s built-in `data-[state=on]:bg-muted` is a tint the eye
                  loses on a `bg-card` bar — both items read identically on screen — so the selected
                  one is lifted onto `bg-card` with a shadow over a muted track instead. */}
              <ToggleGroup
                type="single"
                value={draft.published ? "publish" : "draft"}
                onValueChange={(value) => value && onPatch({ published: value === "publish" })}
                aria-label="What this save does"
                className="gap-0 rounded-lg bg-muted p-0.5"
              >
                <ToggleGroupItem value="draft" className="text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                  Draft
                </ToggleGroupItem>
                <ToggleGroupItem value="publish" className="text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                  Publish now
                </ToggleGroupItem>
              </ToggleGroup>

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
              <Button type="submit" disabled={isPending || slugTaken || uploading}>
                {isPending || uploading ? <Spinner /> : <Save />}
                {isPending ? "Saving…" : uploading ? "Waiting for a photo…" : "Save recipe"}
              </Button>
            </form>
          </div>

          {/* The blocking alert rides *inside* the sticky block, stacked under the bar row, because
              it explains a disabled button and has to travel with it — pinned Save plus an
              explanation left up the page is how you get someone poking a dead button. It is safe
              to pin precisely because it is one line of fixed height, which is what separates it
              from the failed-photo list below (decision 4).

              A collision has no fix on this panel — the address follows the title and there is no
              field for it, on purpose (decision 11). So the only useful control is a way back to
              the thing that has to change. */}
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-t border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" />
              <span className="flex-1">{error}</span>

              {slugTaken ? (
                <Button type="button" variant="outline" size="sm" onClick={onBackToDetails}>
                  Back to Details
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Failed photos stay in the ordinary flow rather than joining the bar, and that is the split
          decision 4 turns on: this alert is one line *per photo*. `stepsSchema` has a `.min(1)` and
          no max, so going offline mid-recipe on a 12-step bake makes thirteen lines — pinned to the
          viewport that is the whole screen. The bar carries the bounded count instead.

          The button's destination and label are derived together (see `backToPhoto`), so the label
          always names the panel the click actually opens: a fixed "Back to Method" dropped a failed
          *cover* on the one panel with no cover field on it.

          Saving is still allowed. A failed photo is a photo the recipe will not have, which is a
          state worth reporting and not one worth refusing — unlike an upload still in flight,
          which would be silently dropped from a payload built a moment too early. */}
      {failedPhotos.length > 0 ? (
        <div role="alert" className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 space-y-1">
            {failedPhotos.map((photo) => (
              <p key={photo.label}>
                <b>{photo.label}</b> did not upload. {photo.reason}
              </p>
            ))}
            <p className="text-destructive/80">Saving now publishes the recipe without them.</p>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={backToPhoto.onClick}>
            {backToPhoto.label}
          </Button>
        </div>
      ) : null}

      {/* The caption carries two things the deleted card header used to. `"Review & publish"` was
          redundant — the Stepper's fourth item says it — but *"written in one save"* is the only
          place the UI states that this is one transaction rather than four incremental saves, which
          is the same fact that made the step client state rather than a route. It also labels the
          article, which would otherwise be an unlabelled full-width recipe page sitting under a
          Save button, looking a fair bit like something already published (decision 6).
          Steps 1–3 caption their preview the same way; Review would have been the one that did not.

          It scrolls with the article because it describes the article. */}
      <div>
        <div className="mb-3">
          <p className="text-sm font-semibold">Preview</p>
          <p className="text-xs text-muted-foreground">Everything here is written in one save.</p>
        </div>

        {/* The real article, the same component the two recipe routes render, centred at its true
            reading width on `bg-background` rather than parked left inside a white card. The
            surface colour is a fidelity gain and not just a container swap: the live recipe page
            renders on the cream `--background`, so a `bg-card` preview was whiter than the page it
            claimed to preview. Centring is what deleting the checklist bought — `align="start"`
            existed to stop a narrow column floating away from the list that used to sit above it,
            and with the list gone the prop had no callers and was deleted. */}
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <RecipeArticle recipe={preview} placeholders />
        </div>
      </div>
    </>
  );
}
