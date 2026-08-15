# Plan: Recipe detail page overhaul

## Goal

Replace how a recipe looks, not what it says. `RecipeArticle` renders correct content in a shape
nobody designed: a full-column square with a black scrim over it, the title and meta overlaid on the
photo, then two bare `<h2>`s separated by `<Separator>` blocks. Nothing on it reuses the visual
language the rest of the site already has — `heroSection.tsx` frames photos in a matted card, uses
frosted overlay labels and wide-tracked uppercase micro-labels, and the recipe page adopts none of
it.

The complaint that started this was "it looks plain and unbranded". The diagnosis that came out of
the brainstorm is narrower and more useful: **the detail page was built to a design system that
exists elsewhere in this repo and was never applied here.**

Same content, same data, same queries. No new sections, no schema change, no new route.

## Non-goals

- **Dark mode.** It was mocked and it survives — `background 0.18` / `card 0.22` / `border 0.30`
  gives enough separation and the orange holds — but the tinted band nearly vanishes at the 34% mix
  that works in light. Deferred deliberately, not overlooked.
- **Phone layout.** The stat bar needs to become 2×2 below roughly 640px; four cells at 390px gives
  each ~90px and "1 h 45" beside an icon does not fit. Also deferred.
- **The cover-less recipe.** Six of the seven rows in the database today have no cover, but those are
  test recipes. A published recipe is expected to have one, so the design assumes it. See Risks — this
  is the assumption most likely to bite.
- **Print / Share / Save buttons, star ratings, an author byline, tags.** None of these exist as
  features. The reference design that inspired the layout has all of them; putting them on the page
  would be decoration pretending to be function.
- **The Notes section.** Removed from the page.
- **The wizard's live preview rail.** It keeps today's look — see Components.
- **Scrollspy.** The navigator's links work with no JavaScript. Highlighting the section you are
  currently in would need a client component and is not worth it yet.

## Context

Read `CLAUDE.md` first — the conventions for imports, Tailwind tokens, server/client boundaries and
the page-shell pattern all live there and are not repeated here. What is specific to this change:

- **`components/shared/RecipeArticle.tsx` is rendered by four callers**, and its own header comment
  explains why it lives in `shared/` rather than under a route: `/recipes/[slug]`,
  `/admin/preview/[slug]`, `ReviewPanel.tsx` and `PreviewRail.tsx`. Three of those get the new design.
- **That file may never gain a server-only import.** It is a server component on two routes _and_ is
  compiled into the wizard's client bundle. The existing comment lists every import it has so an
  addition can be checked against it. That constraint now extends to `useState`.
- **`#ingredients-heading` and `#steps-heading` are load-bearing ids.** `PreviewRail.tsx` queries them
  to scroll the rail, and its comment calls them "part of its markup contract". The new navigator
  targets the same two ids.
- **Every stored photo is a square the uploader cropped by hand.** `docs/image-storage.md` and
  decision 13 of the recipe-images plan settle that the file _is_ the final framing, which is why
  `RecipeArticle` does no aspect handling at all. The new design keeps that.
- **`RecipeCard.tsx` holds `tileColor(slug)`** — an FNV-1a hash producing a stable oklch tile for
  cover-less recipes in the grid. Not used by this plan, but it is the ready-made answer if the
  cover-less case ever needs one.
- `types/recipes.ts` `RecipeView` is unchanged. Nothing here needs a new field.

## Approach

One reading column at `max-w-3xl`, five parts stacked, no multi-column layout and no sticky rails.
The information order is inverted from today: **title first, photo second, numbers third** — taken
from the reference design the owner brought, and the opposite of what the page does now.

The page opens with a **tinted header band** carrying the title, description and difficulty badge.
That is not a new invention: it is the page-shell pattern every other page on the site already uses,
which is what makes it the cheapest way to give the title its own surface and delete the scrim.

Below it, the cover photo and a four-cell stat bar are **welded into a single bordered object** — one
`border`, one radius, `overflow-hidden`, photo on top and stats attached to its base. Four earlier
attempts at a separate facts card were all rejected as "a box with four numbers in it"; sharing a
border makes the photo and its numbers one thing instead of a third floating box, and removes a card
from the page.

Then two matching white cards, **Ingredients** and **Method**, built from one card class so nothing
is styled per-section. Ingredients are **tickable** — the one genuinely interactive element, and the
only part of this plan that is not purely presentational. Method uses filled orange numerals with no
connector line.

A **floating pill navigator** sits bottom-centre for the whole scroll, anchoring to the two heading
ids that already exist.

One icon rule across the whole page: **18px, `currentColor`, no tinted tiles**, from `lucide-react`
which is already a dependency.

The route of alternatives that got here — photo-first layouts, a split hero, a full-bleed cover, a
proportional time bar, a serif display face, four separate facts treatments — is in `decisions.md`.

See [assets/recipe-detail-design.html](assets/recipe-detail-design.html) for the rendered design and
the per-part measurements.

## Components

- **`components/shared/RecipeArticle.tsx`** — rewritten presentation. Gains the band, the welded hero
  object, the two cards, the icons and the navigator. Keeps its `placeholders` prop, its two heading
  ids, its prop type, and its import discipline. Must not gain `useState` or a server-only import.
- **A new `"use client"` ingredient-list child** — owns the tick state and the live "2 of 6" count.
  Placement follows `CLAUDE.md`'s rule that route-specific components colocate but domain-shared ones
  do not; this one is used wherever the article is, so it belongs beside it in `components/shared/`.
- **`app/recipes/[slug]/page.tsx`** — `RecipeFallback` must be redrawn to the new geometry. It
  currently paints the pre-overhaul layout. The `Suspense` boundary and the deliberately non-async
  page component stay exactly as they are; both are load-bearing under `cacheComponents`.
- **`app/admin/_components/recipe-wizard/PreviewRail.tsx`** — must keep rendering today's look. This
  is the one component that needs a decision at implementation time (see Open questions).
- **`app/admin/_components/recipe-wizard/ReviewPanel.tsx`** — no change needed; it renders the article
  full width and inherits the new design, which is the intent.
- **`app/admin/preview/[slug]/page.tsx`** — no change; inherits.

## Risks

- **The rail exclusion has no mechanism yet.** `PreviewRail` renders the _same_ `RecipeArticle`; it
  looks different today only because it is wrapped in a `Card`, clipped at `max-h-152` and squeezed
  into a `minmax(19rem, 0.95fr)` grid column. Overhauling the article changes the rail unless
  something is done. Both available answers cost something — see Open questions.
- **Two renderers is the drift problem this repo has already argued against.** `PreviewRail`'s own
  comment calls a second renderer "the drift problem in its purest form". Whatever mechanism is
  chosen, it must not become a second copy of the content, or the next field added to a recipe has to
  be added twice.
- **Ticking pushes the ingredient list across the server/client line.** Contained if the state lives
  in a small child. If it leaks into `RecipeArticle` itself the build breaks at the wizard, and the
  error points at `RecipeWizard` rather than at the change that caused it — the existing header
  comment exists precisely because that error is hard to trace.
- **Ticks are meaningless inside the wizard preview.** Harmless, but the checkboxes will be clickable
  there. Worth a glance rather than a guard.
- **The design assumes a cover photo.** Accepted on the basis that the cover-less rows are test data
  and a published recipe will always have one. If that turns out to be wrong, the welded stat bar has
  nothing to attach to and the mitigation is `tileColor()` from `RecipeCard`, which already solves
  exactly this for the grid.
- **The skeleton is the easiest thing here to forget.** It lives in a different file from the
  component being changed, and nothing fails if it is skipped — the page just flashes the old layout
  on every cold load.
- **The pill overlaps the end of the page.** The article needs bottom padding so the last step is not
  hidden underneath it.

## Open questions

- **How does `PreviewRail` keep the old look?** Either a variant prop on `RecipeArticle` (one
  component, two skins, no content duplication — but a prop that exists for exactly one caller), or a
  separate compact preview component (clean separation, at the cost of the drift risk above). Not
  settled; decide before writing code.
- **Do ticks survive a reload?** In-memory `useState` resets on refresh. `localStorage` keyed by slug
  is the obvious upgrade. Pick one deliberately rather than discovering the reset later.
- **Does the "2 of 6" count stay?** It was added to give the card header a right-hand element. It
  earns its place once rows are tickable, but it is cuttable if it reads as clutter.
- **Does the Method card get a count too?** "3 steps" is static and less useful than the live tick
  count beside it. Keeping both is consistent; keeping only the live one is more honest.

## Assets

- [assets/recipe-detail-design.html](assets/recipe-detail-design.html) — the settled design rendered
  at desktop width against the project's real oklch tokens, plus a per-part anatomy with the
  measurements and tokens, the skeleton drawn, and the list of load-bearing details.
