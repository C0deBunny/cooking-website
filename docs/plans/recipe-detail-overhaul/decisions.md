# Decisions: Recipe detail page overhaul

## 1. Give the new design to three surfaces, not four

- **Date:** 2026-08-16
- **Considered:** all four callers, one component · public page only, forking the component ·
  public + `/admin/preview` + Review & Publish, excluding the wizard's live rail
- **Chosen:** the last — `/recipes/[slug]`, `/admin/preview/[slug]` and `ReviewPanel`'s preview get
  the new design; `PreviewRail` on wizard steps 1–3 keeps today's look. The rail is a while-you-type
  scratchpad; the Review & Publish preview is the fidelity checkpoint before publishing, and it
  already renders full width on `bg-background` for exactly that reason. Excluding the rail also frees
  the design from having to survive a ~300px column.
- **Trade-off:** the rail renders the _same_ `RecipeArticle` today — it looks different only because
  it is wrapped in a `Card`, clipped at `max-h-152` and squeezed into a narrow grid column. So this
  needs a real mechanism, and every option carries the drift risk `PreviewRail`'s own comment warns
  about. Left open in `plan.md` rather than decided blind.
- **Revised 2026-08-16 — the mechanism is chosen, and the stated reason for the exclusion was
  wrong.** "It looks different anyway" is false: the rail is the same component, and left alone it
  would have inherited the redesign in full — including `bg-card` cards nested inside `PreviewRail`'s
  own `bg-card` wrapper, which is white on white with borders as the only separation. The exclusion
  is real work, not the absence of work. See decision 20 for how it is done and what it costs.

## 2. Put the title before the photo

- **Date:** 2026-08-16
- **Considered:** photo-first with the title overlaid (today, and the first three directions
  explored) · title-first, photo second, numbers third
- **Chosen:** title first — taken from the AllRecipes-style reference the owner brought. It gives the
  title its own surface, which is what allows the black scrim to be deleted outright rather than
  restyled.
- **Trade-off:** the reward image is no longer the first thing on screen. Accepted; the scrim was the
  loudest complaint and every alternative that kept the overlay also kept a second colour scheme for
  text-on-photo.

## 3. One reading column, not a split hero or a two-width band

- **Date:** 2026-08-16
- **Considered:** single `max-w-3xl` column · split hero with the photo and facts side by side and a
  sticky ingredients rail · a full-bleed tinted band at 1120 over a 768 body
- **Chosen:** the single column. The stated problem was "it looks plain", not "it wastes the screen" —
  the split hero answers a question nobody asked, and it is the version that has to be re-thought at
  every container width.
- **Trade-off:** roughly 330px of cream sits unused on each side at 1440. The tinted band recovers
  some of that visually without any content moving into it.

## 4. Weld the stat bar to the cover photo

- **Date:** 2026-08-16
- **Considered:** four cells in their own card · hairline-divided cells with the total tinted · an
  inline strip with no card at all · a proportional prep-vs-cook time bar · a circular dial ·
  attaching the stats to the base of the photo
- **Chosen:** welded to the photo. Four separate attempts at a standalone facts card were all
  rejected as "a box with four numbers in it". Sharing one border, one radius and one
  `overflow-hidden` makes the photo and its numbers a single object, and removes a card from the page.
- **Trade-off:** it structurally depends on there being a photo. See decision 12.

## 5. Drop the orange bar from the card tops

- **Date:** 2026-08-16
- **Considered:** a 5px `primary` bar on every card, repeated so it reads as a family mark · no bar,
  cards carried by border, radius and shadow alone
- **Chosen:** no bar.
- **Trade-off:** the accent colour loses its most visible placement on the page. Orange now appears
  only on the step numerals, the checked boxes and the navigator's active item — which is arguably
  better discipline, since those are all things you can act on.

## 6. One icon rule: 18px, currentColor, no tinted tiles

- **Date:** 2026-08-16
- **Considered:** 14px muted icons beside labels · 22px `primary` icons stacked above centred values ·
  rounded tinted tiles in `accent` / `primary` / `secondary` · the midpoint at 18px in `currentColor`
- **Chosen:** the midpoint, applied identically to the stat bar and the card headings. Icons inherit
  text colour and sit on the heading's baseline, so they read as part of the text rather than as
  decoration.
- **Trade-off:** the tinted-tile version was warmer and was the only thing on the page using the tan
  and lime tokens, which remain close to unused in `globals.css`. Uniformity won.

## 7. Make the ingredient list tickable

- **Date:** 2026-08-16
- **Considered:** a right-aligned amount column · amounts as tinted chips · two columns to halve the
  card height · checkboxes you can tick off
- **Chosen:** tickable.
- **Trade-off:** this is the one part of the overhaul that is not purely presentational, and it pushes
  the list across the server/client boundary. `RecipeArticle` cannot hold the state — it is a server
  component on two routes _and_ is compiled into the wizard's client bundle — so the state lives in a
  small `"use client"` child. Ticks also reset on reload unless persisted; left open in `plan.md`.
- **Revised 2026-08-16 — deferred to its own change. Still wanted, not dropped.** Three things
  surfaced under grilling. The live "2 of 6" sits in the card _header_, so the `"use client"` child is
  not "a small list" — it is the entire Ingredients card, carrying `#ingredients-heading` across the
  boundary with it, and that id is a documented markup contract. Persistence, the count and
  meaningless-in-wizard ticks were three of this plan's four open questions, all downstream of one
  feature in an otherwise presentation-only change. And the row shape it needs — amount, name,
  hairline — ships either way, so nothing is thrown out: a later change adds a checkbox to the left of
  the amount and a count to the header. The stated goal is "replace how a recipe looks, not what it
  says"; ticking is the only thing in the plan that was neither.

## 8. Filled step numerals, no connector line

- **Date:** 2026-08-16
- **Considered:** outlined `primary` circles · filled circles joined by a vertical connector, timeline
  style · an oversized ghost numeral in the margin · a tracked "STEP 1" label with no numeral
- **Chosen:** filled circles, connector removed. The hairline between steps already separates them.
- **Trade-off:** the connector made the method read as a sequence rather than a list, and cost nothing
  but a pseudo-element. Dropped for a quieter card. Filled also avoids the collision the outlined
  version had with the real checkboxes in the card directly above it.

## 9. A floating pill navigator, not a sticky sub-bar

- **Date:** 2026-08-16
- **Considered:** a sticky sub-bar under the navbar at `top-16` · a floating pill bottom-centre · a
  side rail in the whitespace · jump chips inside the hero
- **Chosen:** the floating pill. It stays available for the whole scroll without competing with the
  navbar, and it is the form that still works when the phone layout is eventually done.
- **Trade-off:** it overlaps the end of the page, so the article needs bottom padding. The side rail
  was the only option that put the unused horizontal space to work, but it is desktop-only and would
  have needed a second form anyway.
- **Revised 2026-08-16 — not rendered when `placeholders` is on, and the anchors need
  `scroll-mt-24`.** Two defects the mockup could not show. **First:** `ReviewPanel` wraps the article
  in `overflow-hidden rounded-xl`, which makes that div the nearest scroll container — a
  `sticky bottom-5` element sticks to _that_, and since the box has no height cap it never scrolls, so
  the pill renders at its static flow position and the design's `-56px` pull lands it on top of the
  last method card. Removing the wrapper was rejected: its border is what frames the preview as a
  preview rather than as a published page, which `ReviewPanel`'s own comment calls deliberate, and a
  floating navigator inside a preview box competes with the pinned publish bar directly above it.
  **Second:** `Navbar` is `sticky top-0 h-16`, so a bare `#id` jump parks the target behind it —
  `/dev` already carries `scroll-mt-20` for exactly this and `Navbar`'s comment says _"Change it and
  grep top-16."_ 24 rather than 20 because the headings now sit inside a card header, and 20 would
  slice the card's top edge off. The cost of the first half: `placeholders` now decides one thing
  beyond "what stands in for what is missing", so its docstring has to say so.

## 10. Keep the square uncropped — no full-bleed hero

- **Date:** 2026-08-16
- **Considered:** the reference's literal full-bleed photo with the card floating over it · the same
  photo blurred as a backdrop with the true square sharp on top · the card overlapping the bottom of
  an uncropped square · a plain rounded square at column width
- **Chosen:** the plain uncropped square. Full-bleed looked best and would have re-cropped every cover
  to a band, silently overriding a decision this codebase made on purpose — `RecipeArticle` states
  that the stored file _is_ the final framing, which is why it does no aspect handling at all.
- **Trade-off:** the page is taller than the reference that inspired it, and gives up the most
  striking version of the hero. Upholding the existing invariant beat the better-looking option.

## 11. Ship nothing the site cannot back

- **Date:** 2026-08-16
- **Considered:** copying the reference's star rating, review count, "Submitted by" byline, tag line
  and Save/Print/Share buttons · including only what exists
- **Chosen:** none of them. There are no ratings and no reviews; there is one owner, so a byline says
  nothing; tags are a designed-but-unbuilt feature whose page is still a placeholder; Save needs
  accounts, and public signups are deliberately disabled. Print and Share were both real and both cut
  for now.
- **Trade-off:** the hero has less furniture than the reference and the difficulty badge sits alone.
  Better than decoration pretending to be function.

## 12. Assume a cover photo exists

- **Date:** 2026-08-16
- **Considered:** designing for the cover-less case — the generated `tileColor()` tile, a stats bar
  that stands alone when there is no photo, folding the stats into the header band, an owner-only
  "add a photo" prompt · assuming a cover is always present
- **Chosen:** assume one exists. Six of the seven rows in the database have no cover, but they are old
  test recipes; a recipe published from now on will have one.
- **Trade-off:** decision 4 depends on it — with no photo the stat bar has nothing to weld to. The
  mitigation is already written and proven: `tileColor(slug)` in `RecipeCard.tsx` generates a stable
  oklch tile for exactly this case in the grid. Lifting it here would also make the grid and the
  detail page agree, which they do not today.

## 13. Remove the Notes section

- **Date:** 2026-08-16
- **Considered:** keeping it as a fourth card · rendering it only when present · promoting it to a
  "before you start" callout at the top of the method · removing it
- **Chosen:** removed.
- **Trade-off:** three rows in the database have a note, typed straight into Supabase — the wizard has
  no field for it and `draft.ts` hardcodes `notes: null`, so nothing in the app can add more. Those
  three lines stop being shown. Accepted on the basis that they are test data. The `notes` column
  itself is untouched, so this is reversible.
- **Revised 2026-08-16 — `notes` also comes off `RecipeView`, and `toRecipeView` stops mapping it.**
  `RecipeArticle` was its only reader; the manage table reads `recipe.notes` off the row, not the
  view. Left in place it would be a field on a view type with no consumer, which is the dead code this
  repo normally deletes. Reversibility is unchanged — the _column_ is what makes this reversible, and
  restoring the section means adding one line back to a `Pick`.

## 14. Defer dark mode and the phone layout

- **Date:** 2026-08-16
- **Considered:** designing all three viewports and both themes now · shipping desktop light first
- **Chosen:** desktop light first. Both were mocked against the real tokens rather than skipped
  blind: dark survives, and the phone needs the stat bar to go 2×2.
- **Trade-off:** the site has a working theme toggle, so dark mode is reachable today and will be
  slightly off — the tinted band nearly vanishes at the 34% `accent` mix that works in light. Known,
  and cheap to fix when it is picked up.
- **Revised 2026-08-16 — dark mode is back in scope, and the reason recorded above was backwards.**
  The band does not nearly vanish in dark; it is roughly **7.5× louder** than in light. Dark `--accent`
  is `oklch(0.78 …)` — a _light_ tan — against a `oklch(0.18 …)` page, so the same 34% mix that moves
  lightness by 0.027 in light moves it by 0.204 in dark: a slab, not a tint. Rendered against the real
  tokens in [assets/dark-band-check.html](assets/dark-band-check.html). The fix is one `dark:` variant
  on the band's mix percentage, at **10%** (ΔL 0.060 — clearly a band, clearly quieter than the cards
  above it); 4.5% matches light's ΔL exactly but reads as no band at all. Nothing else needed a dark
  pass, which is what the original mock-up had actually established. **The phone layout stays
  deferred** — but on effort, not on design: it is about four responsive prefixes
  (`grid-cols-2 sm:grid-cols-4` on the stat bar, a smaller title, tighter padding, the pill hidden),
  so the honest cost of deferring it is that every phone visitor meanwhile gets four stat cells at
  ~90px each where "1 h 45" beside an 18px icon does not fit.

## 15. Leave the step note untinted

- **Date:** 2026-08-16
- **Considered:** an `accent`/26% callout with padding and a radius, as drawn in the mockups · plain
  italic `text-muted-foreground` directly under the instruction, which is what ships today
- **Chosen:** plain italic, unchanged from today. A coloured callout gave an optional aside more
  visual weight than the instruction it hangs off, and it was the only tinted surface inside a card.
- **Trade-off:** `accent` now appears exactly once on the page — the header band — which makes the tan
  token even closer to unused than decision 6 already noted. Accepted: a colour spent on one thing is
  not a problem, a colour spent on the wrong thing is.

## 16. Reserve the hero's shape in `placeholders` mode, dashed

- **Date:** 2026-08-16
- **Considered:** hide the hero entirely until a cover exists · fill it with `tileColor(slug)` so a
  draft looks like a finished recipe · drop the square and keep the stat bar as a standalone strip ·
  reserve the whole object as a dashed square with a dashed stat bar welded under it
- **Chosen:** reserve it, dashed, with em-dashes in the cells. This is the case that _always_ happens:
  `ReviewPanel` renders `<RecipeArticle recipe={preview} placeholders />`, and a draft has no cover,
  no times and no servings by construction — so decision 4's welded object, the centrepiece of the
  design, has nothing to weld to on every new recipe. Decision 12's "assume a cover exists" is true of
  published recipes and false here. Reserving keeps the review preview the same shape as the page it
  previews, which is the whole reason that panel renders the real article full width.
- **`PLACEHOLDER_META` has to change, not just be reused.** It is three entries today —
  `Prep · Cooking · Serves`, no Total — and the new bar leads with Total and has four cells. Left as
  is, the reserved shape would be three cells that snap to four the moment both times are typed, which
  is the opposite of reserving.
- **Why not `tileColor()`:** it makes an unfinished draft look like a finished recipe with a coloured
  cover, on the one screen whose job is to tell you what is missing before you publish.
- **Trade-off:** the new design now has two hero shapes to keep in step rather than one. Contained by
  the fact that only `ReviewPanel` passes the flag — the two saved-recipe routes never reach it, and a
  published recipe with no cover simply has no hero at all.

## 17. The stat bar's column count follows the data

- **Date:** 2026-08-16
- **Considered:** always four columns with an em-dash in any empty cell · drop Total and always show
  three · one column per filled cell
- **Chosen:** one column per filled cell — four cells split the bar in four, three split it in three,
  and at zero the bar is omitted so the hero is a bordered photo alone. The design was only ever drawn
  at four, but `filled` in `RecipeArticle` builds 0–4: Total needs _both_ times, and each of prep,
  cook and servings drops on its own. `kipsate` has `servings = null` today, so a fixed
  `grid-cols-4` leaves a visible empty quarter with its hairline on a live published recipe — and
  `detailsSchema` marks all four of those fields optional, so a recipe with a cover and nothing else
  is publishable through the wizard, not just a legacy artifact.
- **Why not dash the gaps:** `RecipeArticle`'s existing comment argues the opposite and is right —
  dashes are "a shape for the row", shown only while the _whole_ row is absent, because a public page
  should not announce a gap a reader cannot fill. That is exactly why decision 16 dashes and this one
  does not: a draft's author can fill the gap, a visitor cannot.
- **Trade-off:** cell width varies between recipes, so two recipe pages are not pixel-identical.
  Cheaper than a bar that looks broken on the recipes that exist.

## 18. No counts in either card header

- **Date:** 2026-08-16
- **Considered:** live "2 of 6" on Ingredients and static "3 steps" on Method, as drawn · static
  counts on both · nothing on either
- **Chosen:** nothing. The count was added to give the card header a right-hand element, and its only
  real justification was live tick progress — which decision 7's revision moves to a later change.
  What is left restates a list the reader is looking at. This closes both of the count questions
  `plan.md` left open, and it removes the mismatch of a live count facing a static one in matching
  headers.
- **Trade-off:** the headers are icon-and-title only, with empty space to their right. The slot is
  where the live count goes when ticking lands.

## 19. `DifficultyBadge` gets no icon

- **Date:** 2026-08-16
- **Considered:** the leaf icon drawn in the mockup · an icon per difficulty · no icon
- **Chosen:** no icon, and `DifficultyBadge` is not touched at all. It is also rendered by
  `RecipeRow.tsx` in the manage table, so an icon added here restyles a page that is not in this plan.
  And one icon is really three: `STYLES` is `Record<RecipeDifficulty, string>` precisely so a fourth
  difficulty cannot be added without a matching entry, and an icon map would need the same treatment —
  leaf for easy, and two more nobody has chosen.
- **Trade-off:** the mockup shows the leaf, so the drawn design and the shipped one differ by one
  glyph. The mockup has been corrected rather than left to mislead.

## 20. Move today's `RecipeArticle` for the rail; do not write a second renderer

- **Date:** 2026-08-16
- **Considered:** container queries on the article, so its parts reshape by measured width, with no
  prop and the phone layout falling out of the same rule · a `variant="full" | "compact"` prop · a
  new compact preview component written from scratch · dropping decision 1 and letting the rail
  inherit
- **Chosen:** keep today's component and move it, unchanged, to
  `app/admin/_components/recipe-wizard/`; write the new design fresh in `components/shared/`. Moving
  proven code is what makes "the rail stays exactly as it is" a fact rather than a re-implementation
  from memory. `toRecipeView` stays behind with the new article, since the two route pages import it
  from there and the wizard uses `toPreview` from `draft.ts` instead — so the split is clean, with no
  shared helper straddling both. The moved file belongs under the route because it now has exactly one
  caller in the wizard; leaving it in `shared/` would advertise a reach it no longer has.
- **Why not container queries**, which were the strongest alternative: they do not implement decision 1,
  they overturn it — the rail would get the _new_ design squeezed, not today's look. They would have
  been free, and they would have shipped the deferred phone layout in the same rule. Turned down
  because the rail is wanted unchanged.
- **The drift `PreviewRail`'s comment warns about is two different risks, and only one is real here.**
  _Visual_ drift — the preview no longer looks like the published page — is not a risk of this
  decision, it _is_ decision 1. _Content_ drift is the dangerous one: a field added to a recipe that
  appears in one renderer and not the other, so the preview quietly lies about what is being saved.
  `notes` is the loaded example — the column exists and the wizard has no field for it.
- **So the warning goes on `RecipeView` in `types/recipes.ts`, not in either component.** A new field
  is added to the type first; that is where the person who could cause the drift is standing. Same
  instinct as the `security invoker` warning living in the migration that creates it.
- **Trade-off:** two renderers, permanently, which is the thing this repo has argued against once
  already. What it buys beyond the rail: the dashed-cover reservation stays in the moved file, so
  `admin-create-wizard` decision 21's coupling between that reservation and the rail's scroll effect
  never becomes a constraint on the new design, and `recipe.cover` never has to join that effect's
  dependency array.
- **Checked, not assumed:** both components will carry `#ingredients-heading` and `#steps-heading`.
  `RecipeWizard` renders the rail only when `step !== 3` and `ReviewPanel` only when `step === 3`, so
  they never mount together and there is no duplicate-id collision.
