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

- **Tickable ingredients.** Wanted, and split into its own change — decision 7's revision says why.
  The row shape it needs ships here, so that change adds a checkbox and a header count and nothing
  else.
- **Phone layout.** The stat bar needs to become 2×2 below roughly 640px; four cells at 390px gives
  each ~90px and "1 h 45" beside an icon does not fit. Deferred — but on effort, not design: it is
  about four responsive prefixes, and the deferral is what every phone visitor sees meanwhile.
- **The cover-less recipe.** A published recipe with no cover gets no hero object at all — band, then
  straight to the cards. Not a special layout, just the absence of one. **The assumption worth
  worrying about was never the cover, it was the numbers** — see decision 17.
- **Print / Share / Save buttons, star ratings, an author byline, tags.** None of these exist as
  features. The reference design that inspired the layout has all of them; putting them on the page
  would be decoration pretending to be function.
- **The Notes section.** Removed from the page, and `notes` comes off `RecipeView` with it — the
  article was its only reader.
- **The wizard's live preview rail.** It keeps today's _component_, moved rather than rewritten — see
  Components and decision 20.
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
  addition can be checked against it. The same rule rules out `useState`, which is one of the reasons
  ticking was split out — this change adds no client code at all.
- **`#ingredients-heading` and `#steps-heading` are load-bearing ids.** `PreviewRail.tsx` queries them
  to scroll the rail, and its comment calls them "part of its markup contract". The new navigator
  targets the same two ids.
- **Every stored photo is a square the uploader cropped by hand.** `docs/image-storage.md` and
  decision 13 of the recipe-images plan settle that the file _is_ the final framing, which is why
  `RecipeArticle` does no aspect handling at all. The new design keeps that.
- **`RecipeCard.tsx` holds `tileColor(slug)`** — an FNV-1a hash producing a stable oklch tile for
  cover-less recipes in the grid. Not used by this plan, but it is the ready-made answer if the
  cover-less case ever needs one.
- `types/recipes.ts` `RecipeView` gains no field. It **loses** one: `notes`, whose only reader was the
  section decision 13 removes.
- **`prep_minutes`, `cook_minutes`, `servings` and `difficulty` are all optional** in `detailsSchema`.
  A recipe with a cover and nothing else is publishable through the wizard today, so the band can be a
  title alone and the hero can be a photo with no bar welded to it. Both are real branches, not
  legacy-data artifacts.

## Approach

One reading column at `max-w-3xl`, five parts stacked, no multi-column layout and no sticky rails.
The information order is inverted from today: **title first, photo second, numbers third** — taken
from the reference design the owner brought, and the opposite of what the page does now.

The page opens with a **tinted header band** carrying the title, description and difficulty badge.
That is not a new invention: it is the page-shell pattern every other page on the site already uses,
which is what makes it the cheapest way to give the title its own surface and delete the scrim. It
carries **two mixes, not one** — `accent` at 34% in light and 10% in dark, because dark `accent` is
lighter than dark `background` and one number cannot serve both.

Below it, the cover photo and the stat bar are **welded into a single bordered object** — one
`border`, one radius, `overflow-hidden`, photo on top and stats attached to its base. Four earlier
attempts at a separate facts card were all rejected as "a box with four numbers in it"; sharing a
border makes the photo and its numbers one thing instead of a third floating box, and removes a card
from the page. The bar is drawn at four cells but **renders one column per value it actually has** —
0 to 4, because every field feeding it is optional.

Then two matching white cards, **Ingredients** and **Method**, built from one card class so nothing
is styled per-section. Both headers are icon-and-title with nothing on the right. Method uses filled
orange numerals with no connector line. **Nothing on the page is interactive**, which is what keeps
this change entirely server-rendered.

A **floating pill navigator** sits bottom-centre for the whole scroll, anchoring to the two heading
ids that already exist — which need `scroll-mt-24` to clear the sticky navbar, and which is off in
the wizard's Review preview, where `overflow-hidden` would break it.

One icon rule across the whole page: **18px, `currentColor`, no tinted tiles**, from `lucide-react`
which is already a dependency.

The route of alternatives that got here — photo-first layouts, a split hero, a full-bleed cover, a
proportional time bar, a serif display face, four separate facts treatments — is in `decisions.md`.

See [assets/recipe-detail-design.html](assets/recipe-detail-design.html) for the rendered design and
the per-part measurements.

## Components

- **`components/shared/RecipeArticle.tsx`** — rewritten presentation. Gains the band, the welded hero
  object, the two cards, the icons and the navigator. Keeps its `placeholders` prop, its two heading
  ids and its prop type. Must not gain `useState` or a server-only import — and after decision 7's
  revision it gains no client code at all. **Its header comment enumerates every import so an addition
  can be checked against it; that list changes here** (lucide icons in, `Separator` out) and the
  paragraph has to change with it. The `placeholders` docstring also has to record that the flag now
  suppresses the navigator.
- **`app/admin/_components/recipe-wizard/RecipeArticleCompact.tsx`** — today's `RecipeArticle`, moved
  unchanged, rendered only by `PreviewRail`. `git mv` it rather than reproducing it; `toRecipeView`
  stays behind with the new article. Decision 20.
- **`types/recipes.ts`** — `notes` comes off `RecipeView`. Gains the anti-drift note: two components
  render this type, and a new field has to reach both.
- **`app/recipes/[slug]/page.tsx`** — `RecipeFallback` redrawn to the new geometry. The `Suspense`
  boundary and the deliberately non-async page component stay exactly as they are; both are
  load-bearing under `cacheComponents`.
- **`app/admin/preview/[slug]/page.tsx`** — inherits the article, but **`PreviewFallback` in the same
  file is a second skeleton painting the pre-overhaul layout** and has to be redrawn too. Easy to miss
  because the plan-shaped thought is "the skeleton", singular.
- **`app/admin/_components/recipe-wizard/PreviewRail.tsx`** — one import line changes, to the moved
  component. Nothing else; its scroll effect and its markup contract are unaffected.
- **`app/admin/_components/recipe-wizard/ReviewPanel.tsx`** — no change needed; it renders the article
  full width and inherits the new design, which is the intent. Its `overflow-hidden` wrapper stays, and
  is why the navigator is off there.

## Risks

- **Two renderers, permanently — and only one kind of drift is a risk.** _Visual_ drift is decision 1
  itself: the rail stops looking like the page on purpose. _Content_ drift is the dangerous one — a
  field added to a recipe that reaches one renderer and not the other, so the preview quietly lies
  about what will be saved. That is why the warning goes on `RecipeView`, where the field gets added,
  and not in either component. `notes` is the live example: the column exists, the wizard has no field
  for it.
- **The `placeholders` shape is the case that always happens, not an edge case.** Every new recipe
  reaches Review & Publish with no cover, no times and no servings — so the welded hero has nothing to
  weld to on the one screen that exists to show what is about to be published. Decisions 16 and 17
  cover it; the thing that bites is assuming "assume a cover exists" also covers this.
- **`PLACEHOLDER_META` is three cells and the new bar is four.** Reuse it unchanged and the reserved
  shape snaps from three columns to four the moment both times are typed.
- **Two skeletons, in two files, and neither fails loudly.** `RecipeFallback` and `PreviewFallback`.
  Skip either and that route flashes the old layout on every cold load.
- **The navigator has two ways to look fine and be broken.** Without `scroll-mt-24` the anchors land
  behind the sticky navbar; inside `ReviewPanel`'s `overflow-hidden` it never floats and lands on the
  last method card instead. Neither shows up in a mockup.
- **The pill overlaps the end of the page.** The article needs bottom padding so the last step is not
  hidden underneath it.
- **Dark mode is one click away on every route.** The band now carries two mixes. Verify with the
  toggle, not by trusting the light render.

## Open questions

None. The four that stood here — the rail mechanism, tick persistence, the ingredients count and the
Method count — were closed by decisions 20, 7 (deferred), and 18. What is deliberately left for later
is the phone layout (decision 14) and tickable ingredients (decision 7), both recorded as deferred
rather than open.

## Assets

- [assets/recipe-detail-design.html](assets/recipe-detail-design.html) — the settled design rendered
  at desktop width against the project's real oklch tokens, plus a per-part anatomy with the
  measurements and tokens, the skeleton drawn, and the list of load-bearing details. **Corrected
  2026-08-16** for decisions 7, 18, 19 and the two navigator defects.
- [assets/dark-band-check.html](assets/dark-band-check.html) — the header band in both themes at the
  same 34% mix, a four-rung ladder of dark mixes, and the oklab arithmetic behind them. Built to
  settle decision 14's dark half; it showed the recorded reason was backwards.
