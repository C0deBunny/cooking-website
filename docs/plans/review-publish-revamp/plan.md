# Plan: Review & publish revamp

## Goal

Review & Publish states completeness three times and parks the article in a card two-thirds too
wide. **Replace the checklist with a sticky publish bar, and render the preview as the page it
previews.**

The two complaints that started this are one fault, not two:

- **The checklist is a third restatement.** The Stepper above already shows the same three ✓ marks,
  and the article below shows the actual content. Its only unique cargo is fine print — the recipe's
  address, buried in the publish switch's helper text.
- **The article sits in a dead grey block.** It renders at `max-w-3xl` (768px) with `align="start"`
  inside a card spanning the full ~1232px wizard width.

`align="start"` exists **because of** the checklist, by its own doc comment in
[RecipeArticle.tsx](../../../components/shared/RecipeArticle.tsx) — centring a narrower column
"just makes it float away from the checklist above it". Delete the checklist and the layout fix
follows for free. That is the whole reason this is one change rather than two.

## Non-goals

- **`RecipeArticle`'s hero does not move.** The public recipe page keeps its square, column-width
  hero, and the preview stays the same component — so `admin-create-wizard` decisions 7/15 (no
  second renderer) and 13/20 (no re-crop, column-bleed square) all survive untouched. The only edit
  to the shared component is a **deletion**, and the public page renders byte-identically.
  Decision 1.
- **No 16:9 capture crop.** Ruled out early: it would make `RecipeCard`'s square tile re-crop the
  banner and would orphan every square cover already stored.
- **No change to the write path** — no schema, no migration, no server action, no `save_recipe()`,
  no caching surface.
- **No change to the Stepper**, which stays the one place completeness is shown.

## Context

What this leans on, all verified against the tree at `5ad371d`:

- **`ReviewPanel` is the wizard's only `<form>`**, and it must stay that way — see `CLAUDE.md`, "The
  recipe wizard". The form still wraps the toggle, the hidden payload and Save, and nothing else.
- **`top-16` is the established sticky offset.** [Navbar.tsx](../../../components/feature/layout/navbar/Navbar.tsx)
  is `sticky top-0 z-40 h-16` on every route including admin, and its own comment names the
  convention: _"Change it and grep top-16."_ `AdminSidebar` already clears it correctly.
- **Sticky is viable here** — the classic killer is a scroll or clip ancestor and there is none.
  `SidebarContent`'s `overflow-auto` is inside the rail, [admin/layout.tsx](../../../app/admin/layout.tsx)
  deliberately avoids `SidebarInset`, and there is no `overflow-x-hidden` in `globals.css` or the
  root layout.
- **`components/ui/toggle-group.tsx` already exists**, so the segmented control costs no dependency.
- **Radix sets `type="button"` on Toggle's root**, so a Draft/Publish item inside the `<form>` cannot
  submit it. The submit half of the trap is imaginary; only the empty-value half is real.
- **Losing the counts is safe.** `ingredientsSchema` and `stepsSchema` both carry `.min(1)`
  ([schema.ts](../../../lib/recipes/schema.ts)), and Review is locked until all three parse — so the
  article on this panel can never show "No ingredients yet." The list _is_ the count.
- **[Stepper.tsx](../../../app/admin/_components/recipe-wizard/Stepper.tsx) already claims to be
  "the only place completeness is shown."** The checklist had quietly made that comment false;
  deleting it makes the code match the doc that was already there.

## The design

### The publish bar

One row, `sticky top-16 z-30` — under the navbar's `z-40`, cleared by its 64px — on an opaque
`bg-card` with a border, because the article scrolls under it.

```
← Back │ SAVES TO /recipes/appel-taart │ [⚠ 2 photos missing] │ Draft ▏Publish now │ Save recipe
⚠ "appel-taart" is already taken.                                          [Back to Details]
```

- **`SAVES TO` is the bar's reason to exist, and it swaps with the toggle.** Publish selected →
  `/recipes/appel-taart`; Draft selected → `/admin/preview/appel-taart`. This absorbs the switch's
  helper text entirely and upgrades it: the toggle's consequence becomes something you _see_ rather
  than something a sentence describes.

  **The label is `SAVES TO`, never "permanent address."** The slug follows the title _forever,
  including on edit_ — rename a recipe later and the live URL changes and `updateTag("recipes")`
  404s the old one immediately. A "permanent" label would assert the opposite of the one thing about
  slugs that actually bites. Decision 3.

- **`Draft ▏Publish now`** is a `ToggleGroup type="single"` replacing the `Switch`. **Trap:** radix
  `type="single"` permits deselection, so the value can go empty — guard it,
  `onValueChange={(v) => v && onPatch({ published: v === "publish" })}`, or `draft.published` flips
  to a third meaningless state. Decision 9.

- **Back stays leftmost**, where `PanelNav` has trained the hand on the other three steps, and keeps
  its `type="button"` for the reason `PanelNav`'s comment already states. Decision 5.

### The two alerts are split by whether they block Save

They cannot share a treatment, because they do not behave alike:

|                | blocks Save?                                    | size                   |
| -------------- | ----------------------------------------------- | ---------------------- |
| Slug collision | **yes** — `disabled={… \|\| slugTaken}`         | one line, fixed        |
| Failed photos  | **no** — deliberately, and that is load-bearing | one line **per** photo |

- **The slug alert rides inside the sticky block**, stacked under the bar row. It blocks, so it must
  be wherever the disabled button is — otherwise you scroll to a dead button with the explanation
  off-screen. It is one line of fixed height, so it is safe to pin.
- **The failed-photo detail stays in the flow**, above the article. `stepsSchema` has a `.min(1)` and
  **no max**, so going offline mid-recipe on a 12-step bake makes `failedPhotos` thirteen entries —
  pinned to the viewport, that is the whole screen. Its `backToPhoto` derived label/destination logic
  survives verbatim; it is correct and it was hard-won.
- **A bounded amber chip in the bar** (`⚠ 2 photos missing`) carries the count, so the non-blocking
  warning cannot be missed by someone who scrolled straight to Save. Decisions 4 and 7.

### Below the bar

A caption — `Preview` / `Everything here is written in one save.` — over the article on a
`bg-background` surface, centred at its true width.

- **The caption carries two things at once.** Deleting the card header deletes `"Review & publish"`
  (redundant — the Stepper's fourth item says it) and `"Everything below is written in one save."`
  (**not** redundant — it is the only place the UI states this is one transaction, not four
  incremental saves, which is the same fact that made the step client state rather than a route).
  It also labels the article, which would otherwise be an unlabelled full-width recipe page sitting
  under a Save button, looking a fair bit like something already published. Decision 6.
- **The caption scrolls with the article**, because it describes it.
- **`bg-background`, not `bg-card`.** The current wrapper is a white Card; the real recipe page
  renders on the cream `--background`. This is a fidelity gain, not just a container swap — the
  preview stops being whiter than the page it previews.

### Folded in: the `PreviewRail` sticky bug

[PreviewRail.tsx](../../../app/admin/_components/recipe-wizard/PreviewRail.tsx) sticks at `top-6` —
24px against a 64px opaque navbar. Pre-existing, unrelated to this work, one-token fix, and folded in
because this change is the one that makes `top-16` the panel's own convention. Decision 8.

**Measured, not assumed** ([assets/previewrail-under-navbar.png](assets/previewrail-under-navbar.png)):
with seven steps in the draft, `roomToStick` becomes 680px, sticky engages, and the rail pins at
`railTop: 24` against a `navBottom: 64` — **40px of the rail sits behind the navbar.** "Live preview"
is gone entirely and only the bottom half of "This updates as you fill in the form" is visible.

**Why nobody noticed:** on a short draft the rail does not stick at all. `items-start` sizes the grid
container to its tallest child and the rail _is_ the tallest child (669px vs 669px, `roomToStick: 0`),
so it has zero travel. That is not a bug — it is what `position: sticky` does — but you need roughly
seven steps or a long ingredient list before the overlap appears.

That measurement also derisks the publish bar directly: the bar's containing block is the wizard's
main div, which is as tall as the whole article, so it will have hundreds of pixels of travel. The
`roomToStick: 0` failure mode cannot reach it.

## Files

| File                | Change                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `ReviewPanel.tsx`   | real rewrite — checklist and card out, sticky bar in                                           |
| `RecipeArticle.tsx` | delete the now-dead `align` prop and its doc paragraph                                         |
| `PreviewRail.tsx`   | `top-6` → `top-16` (one token)                                                                 |
| `PanelNav.tsx`      | doc only — it is three panels now, and its `type="button"` rationale follows Back into the bar |

`align` becomes dead code because `ReviewPanel` is its only caller; with the prop unused, every
remaining caller takes the default. Deleting it is the sole edit to the shared component.

## Risks

- **Unbounded `failedPhotos` height** — mitigated by the split above: chip in the bar, detail in the
  flow.
- **`isPending` spinner in a pinned bar is unexercised.** Save currently sits in normal flow; nothing
  has been observed about a spinner in a sticky container mid-submit.
- **The segmented control is new to this codebase.** No `ToggleGroup` is in use anywhere yet, so this
  is the first instance of the pattern.
- **`lg:sticky`, static below it.** Admin is explicitly desktop-first — `AdminSidebar` is
  `collapsible="none"` with a rail that never collapses — so at 400px a five-item bar wraps into a
  tall block, and pinning that would eat half the screen to fix a layout nobody uses.

## Milestones

1. **The bar** — `ReviewPanel` rewrite: sticky container, Back, `SAVES TO`, toggle, Save, and the
   slug alert inside the sticky block.
2. **The preview surface** — caption, `bg-background`, centred; delete `align` from `RecipeArticle`
   and its doc paragraph.
3. **The fold-in** — `PreviewRail` `top-6` → `top-16`, plus the `PanelNav` doc note.

1 and 2 are one commit's worth of work and hard to split, since deleting the checklist is what frees
`align`. 3 is independent and can land either side.

## Verification

- `npm run lint` and `npx tsc --noEmit` clean, per `CLAUDE.md`. There is no test suite.
- **Drive it in the browser** (headed, via Playwright MCP; sign in with `scripts/dev-login.mjs`):
  - the bar pins at 64px with the article scrolling under it, and does not overlap the navbar;
  - `SAVES TO` swaps between `/recipes/…` and `/admin/preview/…` as the toggle moves;
  - a taken title disables Save and shows the collision alert **inside** the sticky block;
  - a failed photo shows the chip in the bar and the detail in the flow, and Save still works;
  - the toggle cannot reach an empty value, and pressing it does not submit the form;
  - `PreviewRail` on a seven-step draft no longer hides its header behind the navbar.
- **Re-measure the overlap** the same way it was measured the first time — `roomToStick`, `railTop`
  and `navBottom` — rather than eyeballing a screenshot.

## Open questions

- **Whether the caption overclaims.** It says "written in one save" while the preview may be showing
  photos that failed to upload. Arguably fine — the recipe _is_ written in one save; the photos just
  are not in it.
- **Sticky behaviour below 1024px** is untested. `/admin` is desktop-first by design, so this is
  probably a non-issue, and `lg:sticky` sidesteps it.

## Prototype

[assets/review-panel-options.html](assets/review-panel-options.html) — four tabs: **Today**, then A,
B and C, at true admin-shell proportions. Keyboard <kbd>1</kbd>–<kbd>4</kbd> to switch, <kbd>A</kbd>
to hide the annotations. The article column really is 768px inside a 1232px card, so the dead space
is measured rather than sketched. It renders a CSS stand-in for the photo, since the file has to open
offline from disk.
