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

## 14. Defer dark mode and the phone layout

- **Date:** 2026-08-16
- **Considered:** designing all three viewports and both themes now · shipping desktop light first
- **Chosen:** desktop light first. Both were mocked against the real tokens rather than skipped
  blind: dark survives, and the phone needs the stat bar to go 2×2.
- **Trade-off:** the site has a working theme toggle, so dark mode is reachable today and will be
  slightly off — the tinted band nearly vanishes at the 34% `accent` mix that works in light. Known,
  and cheap to fix when it is picked up.
