# Decisions: Review & publish revamp

Nine decisions, all reached on 2026-08-09 across a `/brainstorm` → `/visualize` → `/grill-me` pass.
Four of them exist because the grilling falsified something in the first proposal; those say so.

## 1. Fix Review's own layout; leave the square hero everywhere else

- **Date:** 2026-08-09
- **Considered:** change `RecipeArticle`'s hero for everyone · crop covers 16:9 at capture ·
  fix only Review's layout
- **Chosen:** fix only Review. The dead grey space is `align="start"` doing exactly what it was asked
  to — pin a 768px column to the left edge of a ~1150px card — not the photo being square.
- **Why not change the shared hero:** the public recipe page and the preview are deliberately the
  same component, so a hero change is a change to the live site. `admin-create-wizard` decisions 7/15
  (no second renderer) and 13/20 (no re-crop, column-bleed square) all survive by not touching it.
- **Why not crop 16:9 at capture:** `RecipeCard`'s square tile would re-crop the banner, and every
  square cover already in the bucket would be orphaned by the new aspect ratio.
- **Trade-off:** the square hero is still 768px tall on Review and still buries what is under it.
  Accepted — that is the visitor's view, and the preview's job is to be honest about it.

## 2. A publish bar over a centred preview, not a rail and not a minimal edit

- **Date:** 2026-08-09
- **Considered:** **A** publish bar over a true-to-page preview · **B** preview left, publish rail
  right · **C** minimal edit — delete the `<ul>`, keep the card, flip to `align="center"`
- **Chosen:** **A**, after seeing all four states side by side in the prototype. The checklist and the
  dead space are one fault: `align="start"` exists _because_ of the checklist, by its own doc comment.
  Remove the checklist and the layout fix follows for free.
- **Why not B:** the right rail means "preview" for three steps and then abruptly means "controls" on
  the fourth — the same slot doing the opposite job, arguably worse than the layout jump it fixes. It
  also narrows the article to ~620px, so the preview stops being the width a visitor gets.
- **Why not C:** with the checklist gone the top card is three-quarters whitespace — it reads as
  _something was deleted here_, because something was. And Save is still scrolled away by the time
  you have read the recipe you are deciding whether to publish. This was the thing prose could not
  settle and the prototype showed in one flip.
- **Trade-off:** the largest diff of the three, sticky positioning that has to clear the navbar,
  alerts that need rehoming, and the loss of the at-a-glance "3 ingredients, serves 8" counts. The
  counts are safe to lose: both schemas carry `.min(1)` and Review is locked until all three parse,
  so the article can never be empty. The list is the count.

## 3. The address line reads `SAVES TO`, not "permanent address" — and it swaps with the toggle

- **Date:** 2026-08-09
- **Considered:** "Permanent address" · `SAVES TO` swapping with the toggle · always show the public
  URL regardless of the toggle
- **Chosen:** `SAVES TO`, swapping — `/recipes/…` when publishing, `/admin/preview/…` when saving a
  draft. It absorbs the switch's helper text entirely and upgrades it: the toggle's consequence
  becomes something you see rather than something a sentence describes.
- **Why not "permanent":** **this was the first proposal and it was wrong.** `CLAUDE.md` is explicit
  that the slug follows the title _forever, including on edit_ — rename a recipe and the live URL
  changes and `updateTag("recipes")` 404s the old one immediately. The label asserted the opposite of
  the one thing about slugs that will actually bite.
- **Why not always the public URL:** it would be false half the time, and the draft destination is
  exactly the fact the switch's fine print was carrying.
- **Trade-off:** the line changes as you touch the toggle, which is motion in a bar that is otherwise
  static. That is the point — it is what makes the toggle's consequence visible.

## 4. Split the alerts by whether they block Save

- **Date:** 2026-08-09
- **Considered:** both alerts travel with the bar · both stay in the flow · split them
- **Chosen:** split. The **slug collision** rides inside the sticky block; the **failed-photo detail**
  stays in the flow above the article.
- **Why:** "alerts travel with the bar" was the first proposal and it was too coarse — the two do not
  behave alike. The collision blocks Save (`disabled={… || slugTaken}`) and is one line of fixed
  height, so it must be wherever the disabled button is or you scroll to a dead button with the
  explanation off-screen. The failed-photo alert deliberately does **not** block — a failed photo is
  _"a state worth reporting and not one worth refusing"_ — and it is one line **per photo**.
  `stepsSchema` has a `.min(1)` and no max, so a 12-step bake that goes offline produces thirteen
  lines; pinned to the viewport that is the whole screen.
- **Trade-off:** today the warning sits directly above Save, so you cannot save without seeing it.
  Split, Save follows you down the page and the warning does not — bought back by decision 7's chip.

## 5. Keep the generic Back, accepting three back-controls on screen at once

- **Date:** 2026-08-09
- **Considered:** drop Back from the bar and rely on the Stepper · keep Back leftmost
- **Chosen:** keep it, leftmost, where `PanelNav` has trained the hand on the other three steps.
- **Why this is a real decision:** during a slug clash the bar carries `← Back` (to Method) directly
  above `[Back to Details]` (to Details) — two back-arrows, two destinations, stacked — and the
  failed-photo alert in the flow has a third in `backToPhoto`. That derived label exists precisely
  because a fixed one was wrong half the time, so the codebase already knows this is a place that
  misleads. Meanwhile the Stepper is fully clickable: `go()` refuses only step 3.
- **Trade-off:** three back-controls simultaneously visible in the worst case, accepted as the price
  of Back meaning the same thing on all four panels.

## 6. One caption carries both the preview label and the atomicity statement

- **Date:** 2026-08-09
- **Considered:** drop the card header entirely · keep a heading · a caption over the article
- **Chosen:** a caption — `Preview` / `Everything here is written in one save.` — above the article,
  scrolling with the content it describes.
- **Why:** deleting the card deletes two strings and only one is redundant. `"Review & publish"` is
  said by the Stepper's fourth item. `"Everything below is written in one save."` is **the only place
  the UI states this is one transaction, not four incremental saves** — the same architectural fact
  that made the step client state rather than a route, because per-step routes _"would advertise a
  durability `save_recipe()` does not have."_ Drop it and nothing on screen says the wizard does not
  autosave.
- **And it closes a second gap:** without a header the article is an unlabelled full-width recipe page
  sitting under a Save button, looking a fair bit like something already published. Steps 1–3 caption
  their preview (`Live preview` / `This updates as you fill in the form.`); Review would have been the
  one that did not.
- **Trade-off:** the caption scrolls away, so the atomicity statement is not permanently on screen.
  Accepted — it is orientation, not a warning.

## 7. The failed-photo chip in the bar is inert

- **Date:** 2026-08-09
- **Considered:** an inert count · a chip that scrolls to the alert
- **Chosen:** inert. A bounded amber `⚠ 2 photos missing`, no anchor.
- **Why not scroll-to-alert:** it is the obvious fix and it carries the trap. An anchor scroll here has
  to clear **two stacked sticky elements** — the 64px navbar _and_ the publish bar itself — so a plain
  `scrollIntoView` parks the alert underneath both. It needs a `scroll-mt` of roughly navbar + bar
  height, which is a magic number that silently rots the moment the bar's height changes.
- **Trade-off:** someone who scrolled to the bottom reads "2 photos missing" and has to hunt upward for
  which two. Accepted as the cheaper failure: a short hunt beats a hidden alert that looks like it
  worked.

## 8. Fold the `PreviewRail` sticky fix into this change, with measurements as evidence

- **Date:** 2026-08-09
- **Considered:** leave it — unrelated pre-existing bug · fold it in
- **Chosen:** fold it in. `top-6` → `top-16`, one token.
- **Why:** it is 24px against a 64px opaque navbar, and this is the change that makes `top-16` the
  panel's own convention — the navbar's comment already says _"Change it and grep top-16."_
- **Measured rather than asserted**, after the first attempt was about to ship the claim unverified:
  with seven steps, `roomToStick` becomes 680px, sticky engages, and the rail pins at `railTop: 24`
  against `navBottom: 64` — 40px behind the navbar, with "Live preview" gone entirely. Screenshot in
  [assets/previewrail-under-navbar.png](assets/previewrail-under-navbar.png).
- **Second finding, which is why nobody noticed:** on a short draft the rail does not stick at all.
  `items-start` sizes the grid container to its tallest child and the rail _is_ that child
  (669px vs 669px, `roomToStick: 0`). You need about seven steps before the overlap exists to be seen.
- **Trade-off:** one unrelated file in the diff. Cheap, and the measurement derisks the bar itself —
  the bar's containing block is as tall as the whole article, so `roomToStick: 0` cannot reach it.

## 9. A segmented `Draft ▏Publish now` replaces the `Switch`

- **Date:** 2026-08-09
- **Considered:** keep the existing `Switch` · a `ToggleGroup type="single"` segmented control
- **Chosen:** the segmented control. A lone switch's state is only readable if you already know which
  way is "on", and this is the last screen before a live URL exists.
- **Trap:** radix `type="single"` permits deselection, so the value can go empty — guard it,
  `onValueChange={(v) => v && onPatch({ published: v === "publish" })}`, or `draft.published` flips to
  a third meaningless state. The _other_ half of the trap is imaginary: radix already sets
  `type="button"` on Toggle's root, so an item inside the `<form>` cannot submit it. No submit guard
  is needed.
- **Trade-off:** the existing `Switch` is a legitimate boolean and swapping it is churn, and this is
  the first `ToggleGroup` in the codebase.
- **⚠ Weakest decision here.** It was proposed rather than chosen — the record shows no objection, not
  an endorsement. It is also the most reversible thing in the plan: keeping the `Switch` costs nothing
  else in the design, since decision 3's swapping address line works either way. Revisit it first if
  any of this needs trimming.
- **Amended on implementation, 2026-08-10 — kept, but not stock.** `ToggleGroupItem`'s built-in
  `data-[state=on]:bg-muted` is a tint that disappears on a `bg-card` bar: on screen both items read
  identically, which is the exact failure this decision exists to fix. The control is a `bg-muted`
  track with the selected item lifted onto `bg-card` with a shadow — the shape the prototype drew.
  The empty-value guard is verified: pressing the selected item leaves it selected. So is the other
  half — `type="button"` is on both items in the DOM, and neither a click nor <kbd>Enter</kbd> on one
  submits the form.
