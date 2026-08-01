# Decisions: Recipe Creator wizard

## 1. Four steps, held in client state on one route

- **Date:** 2026-08-01
- **Considered:** client-side step state in a single route · real routes
  (`/admin/create/details`, `/ingredients`, …) with a Context provider in a `create/layout.tsx`
  to keep state alive across navigation · one route with the step mirrored to a `?step=` query
  param
- **Chosen:** client-side state. The recipe cannot be saved in pieces — `save_recipe()` writes
  the whole thing in one transaction — so real navigation would advertise a durability the write
  path does not have. It also avoids adding another `usePathname` or `useSearchParams` under
  `cacheComponents`; `CLAUDE.md` already records `usePathname` becoming a build blocker once
  `/admin` gained its first `[slug]` child, and `useSearchParams` would need its own `Suspense`
  boundary for the same reason.
- **Trade-off:** no deep links to a step, and the browser back button leaves the wizard instead
  of stepping back through it. Both are acceptable for a screen used by one person a handful of
  times a month.

## 2. The stepper's ✓ is a zod parse, and invalid input is made unreachable

- **Date:** 2026-08-01
- **Considered:** sanitise the inputs so nothing invalid can be typed, then drive the tick from
  `safeParse` · leave inputs permissive, drive the tick from `safeParse`, and build a per-field
  error-display layer · both
- **Chosen:** sanitise plus parse-driven ticks. The first mockup ticked Details on
  `title.trim().length > 0` while `optionalNumber` rejects `NaN`, zero, negatives and stray
  decimals — so typing `abc` into Prep time produced **Details ✓ Complete**, an unlocked Review
  step, three green checklist rows, and then a server rejection reading "Prep time must be
  greater than 0." A hand-written completeness helper always drifts from the schema; the split
  into `detailsSchema` / `ingredientsSchema` / `stepsSchema` only pays off if the tick is
  literally that schema's `safeParse`.
- **Why sanitising rather than an error layer:** wiring the tick to zod without it swaps a wrong
  tick for a silent one — Details un-ticks and Review re-locks with nothing on screen explaining
  why, which is worse. Sanitising removes the invalid state instead of reporting it. Two rules
  are needed, not one: `prep_minutes` / `cook_minutes` / `servings` are
  `optionalNumber({ integer: true })` and take digits only, while ingredient `amount` is
  `{ integer: false }` and takes more (see decision 5).
- **Trade-off:** the invariant is unenforced. It holds only while every input that can produce an
  invalid value has a matching sanitiser, and nothing fails if a future field arrives without
  one. Two exceptions were handled separately because sanitising cannot reach them — an empty
  title, which is self-evident, and a title that produces no slug, which is not (decision 10).

## 3. Ingredient groups are removed entirely, schema included

- **Date:** 2026-08-01
- **Considered:** drop the Group input but keep the column · remove the whole feature —
  column, `save_recipe` read, zod contiguity check and grouped rendering
- **Chosen:** remove all of it. Keeping an unwritten column means `save_recipe` keeps a read
  nothing sends, `RecipeArticle` keeps a grouping pass that always yields one group, and the zod
  contiguity refine keeps guarding an invariant nothing can violate — three pieces of machinery
  maintained for a feature that is gone. This supersedes decision 7 of
  `docs/plans/recipe-schema-redesign/decisions.md`, which chose a denormalised `group_label` over
  an `ingredient_groups` table; that entry stays as written and gains a pointer here.
- **Trade-off:** the drop is irreversible and there is no drift detection to catch data loss —
  Docker is unavailable, so `db diff` and `db dump` do not run. A `select count(*)` gate before
  `db:push` is the only guard, and it is a human step. Regrouping later means a new migration and
  re-entering the labels by hand.
- **Side benefit worth noting:** "group order is order of first appearance" and the contiguity
  rule it required were the most intricate part of the ingredient model. Both disappear.

## 4. Difficulty gets its own colour tokens, not the existing semantic ones

- **Date:** 2026-08-01
- **Considered:** map easy/medium/hard onto the palette's existing `--secondary` (green),
  `--primary` (orange) and `--destructive` (red) · add six dedicated
  `--difficulty-*` tokens
- **Chosen:** dedicated tokens. The existing three already carry meanings that collide: `hard`
  would track the danger colour, so restyling a delete button would restyle a recipe, and
  `medium` would make the brand orange mean "medium" wherever a badge sits beside a primary
  button. Three token pairs decouple them for about six lines of CSS.
- **Where it renders:** `RecipeArticle` — replacing a flat `<Badge variant="secondary">` that
  paints all three difficulties the same green — and `RecipeRow`'s Difficulty field, which is
  plain capitalised text today. The live preview inherits it through `RecipeArticle`.
- **Also considered and declined:** `RecipeCard`, which shows no difficulty at all today, so
  adding one is new information on the public list page rather than a restyle; and the wizard's
  Review checklist, where the full article directly below already shows it.
- **Trade-off:** a fourth difficulty would need a token pair as well as an enum value. Also
  rejected: a colour dot inside the pill, which was built and looked noisy.

## 5. Amounts accept fractions and commas, and render back as glyphs

- **Date:** 2026-08-01
- **Considered:** digits and a dot only · digits plus a comma or a dot, normalised · that plus
  `n/m` fractions parsed to a decimal
- **Chosen:** all three forms. `Number("0,5")` is `NaN`, and a Dutch keyboard and a Dutch cook
  both produce a comma — blocking it means a keystroke that silently does nothing, or worse,
  `"0,5"` becoming `"05"`. Fractions are how recipes are actually written.
- **Consequence, handled:** `amount` is `numeric`, so `1/2` stores as `0.5` and would read back
  as "0.5 tl". `formatAmount()` in `RecipeArticle` therefore maps the common decimals to glyphs —
  ½ ¼ ¾ ⅓ ⅔, with a whole part prefixed — so the round trip looks like what was typed. The
  public page gets this too, which is where it matters most.
- **Trade-off:** the glyph table is a small pile of magic numbers, and the mapping is lossy in
  one direction — `0.4` has no clean fraction and prints as `0.4`. Preserving exactly what was
  typed would mean storing text instead of a number, which is a schema change and loses
  arithmetic.

## 6. Servings belongs to Ingredients, not Details

- **Date:** 2026-08-01
- **Considered:** leave Servings on Details · move it to Ingredients · merge Details and
  Ingredients into one step, making the wizard three steps
- **Chosen:** move it. Once groups were removed, Details had four metadata fields — three across
  and an orphan — while Ingredients was a bare three-column table with nothing but rows. Servings
  is what the amounts are relative to, so it reads better above the list than beside the cooking
  times, and moving it fixes both panels at once.
- **Trade-off:** "how many does it serve" is arguably a detail, and someone scanning Details for
  it will not find it. Merging into three steps was rejected because the combined panel would
  carry a title, a description, four metadata fields and an unbounded list — which is the
  scrolling form this work exists to replace.

## 7. `RecipeArticle` takes a view type, not database rows

- **Date:** 2026-08-01
- **Considered:** a `draftToRecipe()` adapter fabricating objects that satisfy
  `RecipeWithChildren` with synthetic ids · narrowing `RecipeArticle`'s prop type to only the
  fields it renders · a second, preview-only renderer
- **Chosen:** narrow the prop type. `RecipeArticle` keys its lists off `ingredient.id` and
  renders `step.step_number`; a draft has neither, so the adapter would exist purely to invent
  them — and would need updating every time a column is added to `recipe_ingredients` or
  `recipe_steps`, breaking a fake-row constructor whose only consumer is a preview. Real rows
  satisfy the narrow type structurally, so both existing call sites keep working through one
  small mapper.
- **Trade-off:** two call sites change to build a mapped object, and list keys become the array
  index. Index keys are fine here because the article is a static render, and `index + 1` is a
  correct step number only because `getRecipeBySlug` and `getDraftBySlug` order the children in
  the query — a future caller that skips that ordering would silently renumber the method.
- **Why not a second renderer:** it is the drift problem in its purest form. Two components
  rendering one recipe means a layout change has to be made twice, and the day it is made once
  the preview starts lying about the page it claims to preview.

## 8. `RecipeArticle` may never gain a server-only import

- **Date:** 2026-08-01
- **Considered:** accept the constraint and record it · keep `RecipeArticle` server-only and
  give the preview its own renderer
- **Chosen:** accept it. The wizard is a client component, so importing `RecipeArticle` compiles
  it into the client bundle as well as leaving it a server component for the two pages that
  import it from the server. It imports only `Badge`, `Separator` and types today, so nothing is
  broken — but from now on it cannot import `next/headers`, `cookies()`, or a Supabase server
  client.
- **Trade-off:** an unenforced constraint on a shared component. Nothing warns; the failure
  arrives as a build error pointing at the wizard rather than at the import that caused it. This
  entry exists so the error is searchable.

## 9. The slug is derived, hidden, and follows the title forever

- **Date:** 2026-08-01
- **Considered:** a visible slug field with the "stop overwriting once edited" behaviour the
  current form has · derived and hidden, frozen after the first save · derived and hidden,
  always following the title · hidden on create but exposed as an editable field on edit
- **Chosen:** derived and always following the title, on create **and** edit. One rule
  everywhere, no field, no asymmetry between routes. `save_recipe`'s update branch already writes
  `slug`, and the cache-tag comment in `getRecipeBySlug` already reasons about renames, so this
  is behaviour the codebase anticipated.
- **Trade-off, and it is the sharp one:** editing a published recipe's title changes its URL, and
  `updateTag("recipes")` clears the cached entry on the same response — so the old address 404s
  on the very next request, with no redirect and no grace period. Mitigated, not solved, by
  warning on the URL line when editing an already-published recipe whose title change would alter
  the slug. Create stays silent, because nothing is linked yet.
- **Deferred:** a `recipe_slugs` history table that `/recipes/[slug]` falls back to, redirecting
  dead addresses to the current one. That is a table, a migration, a query change and RLS
  policies — a phase of its own, not a form tweak.
- **Also rejected:** freezing the slug after creation, which never breaks a link but leaves a
  typo in the URL permanently uncorrectable; and exposing the field on edit only, which is the
  only option where a wrong URL is fixable, but reintroduces the field this decision removes.

## 10. A title that produces no slug is explained on the URL line

- **Date:** 2026-08-01
- **Considered:** ignore it as unreachable · explain it on the read-only URL line · make
  `slugify()` fall back to a guaranteed-valid string
- **Chosen:** explain it. `slugify()` strips everything outside `[a-z0-9]` after removing
  diacritics, so `"Café"` becomes `cafe` but `"№1"`, an emoji, or non-Latin script becomes `""` —
  and `recipeSchema` requires `slug.min(1)`. With the tick driven by `safeParse` (decision 2),
  that produces a filled-in title, a locked Review step, and no stated reason. The URL line is
  already where the user looks for this, so it becomes the message.
- **Trade-off:** a condition that will almost never fire on a Dutch/Surinamese recipe site gets
  three lines of code. Worth it because the failure mode is a dead-end UI rather than a wrong
  result. A fallback slug was rejected because it produces an address the author did not choose
  and — with no slug field — cannot change.

## 11. A slug collision asks for a different title, with no escape hatch

- **Date:** 2026-08-01
- **Considered:** reveal an editable slug input when `save_recipe` returns 23505 · state that
  the address is taken and ask for a different title
- **Chosen:** ask for a different title. An "Edit URL" affordance that appears only on error is
  a field the design otherwise does not have, existing for one path.
- **Trade-off:** two recipes can never share a title, and there is no way to keep a title while
  changing only its address. Acceptable on a single-author site; it would not be on a
  multi-author one.

## 12. Only the Review panel is a `<form>`

- **Date:** 2026-08-01
- **Considered:** one `<form>` wrapping the whole wizard, as `RecipeForm` does today, with an
  `onKeyDown` guard suppressing Enter outside textareas · one form where Enter advances to the
  next step · no form on steps 1–3, with only the Review panel wrapping one
- **Chosen:** no form on steps 1–3. Inside a `<form>`, Enter in any text input triggers implicit
  submission against the first submit button — so a single wrapping form lets a habitual Enter
  after typing the title fire `saveRecipe` with one field filled. Removing the form element
  removes the mechanism rather than suppressing it; the hidden `payload` field reads React state,
  so the inputs living outside the form costs nothing.
- **Trade-off:** the `Suspense` boundary that `cacheComponents` requires around a bound server
  action moves to the Review panel, which is less obvious than having it wrap the whole page.
  Enter-to-advance was rejected as a shortcut that surprises more often than it helps — it fires
  from a half-filled step just as readily as a complete one.

## 13. One save, on Review — no Save Draft button

- **Date:** 2026-08-01
- **Considered:** a header "Save Draft" available from any step, with `saveRecipe` changed to
  return the new id so subsequent saves update rather than insert · "Save Draft" reusing
  `saveRecipe` unchanged, which redirects away · no such button, one save on the last step
- **Chosen:** one save. The publish switch on Review decides draft versus live, so "save as a
  draft" is already expressible. The id-capturing variant is where the trap is: a recipe has no
  id until its first save, so a Save Draft that stays on the page must thread the returned id
  back into the draft — miss that and the second click inserts a second recipe, or trips 23505 on
  the slug.
- **Trade-off:** no checkpoint. Everything typed is unsaved until the last step, which compounds
  decision 14.

## 14. No autosave, no `beforeunload`, no refresh recovery

- **Date:** 2026-08-01
- **Considered:** mirror the draft to `localStorage` with a "restore draft?" prompt · a native
  `beforeunload` warning while dirty · neither
- **Chosen:** neither, as an explicit scope cut. Logged in `docs/known-issues.md` rather than
  left implicit.
- **Trade-off:** a four-step wizard is meaningfully more expensive to lose than the one-page form
  it replaces, and combined with decision 13 there is no save point at all until Review. One
  accidental refresh, one closed tab, or one click on a sidebar link empties everything.
  `localStorage` remains the cheap fix if it starts biting.

## 15. The preview is the real article, and disappears below 1024px

- **Date:** 2026-08-01
- **Considered:** a compact bespoke preview card matching the reference layout · the real
  `RecipeArticle` narrowed into the rail · a scaled iframe of the live page
- **Chosen:** the real article. With no images anywhere in this project, a recipe's entire
  appearance is text — which is exactly what a preview can show faithfully. A bespoke card is a
  second renderer that will drift (see decision 7) and shows something the published page does
  not.
- **Narrow screens:** not rendered below 1024px; the form goes full width. `/admin` is already
  desktop-first because `AdminSidebar` is `collapsible="none"` with a fixed 16rem rail that never
  collapses. A `Sheet` was considered — the primitive is installed — and rejected as a second
  rendering path to maintain for a screen used at a desk.
- **Trade-off:** the rail is narrow, so the article renders at a width the public page never uses.
  The preview emphasises the section matching the current step by dimming the other two, which
  was flagged as adjustable if it reads as broken rather than focused.

## 16. Category, cuisine, images, notes and tags all stay out

- **Date:** 2026-08-01
- **Considered:** matching the reference layout field-for-field · shipping only what the current
  schema supports
- **Chosen:** only what the schema supports. **Category and cuisine** have no columns — adding
  them is a migration, not a form change. **Images** have no Storage bucket at all
  (`docs/image-storage.md`); `image_path` stays null and no upload control appears. **Notes**
  keeps its column and its `save_recipe` read, and the form sends null — deferred, not removed.
  **Tags** are a sidebar placeholder with no schema behind them.
- **Trade-off:** the wizard is visibly sparser than the layout it was modelled on, and notes —
  which the current form supports — is a capability temporarily lost. `README.md`'s Planned
  Features list is being pruned to reflect what is genuinely pending, since it still advertises
  several things that have shipped.

## 17. One plan, four commits, groups first

- **Date:** 2026-08-01
- **Considered:** one plan with four phase boundaries · splitting the groups removal into its own
  plan folder, since a destructive migration is a different risk class from a UI redesign · one
  continuous spec with no commit points
- **Chosen:** one plan, four committable phases. They serve one goal and the later ones depend on
  the earlier ones, so splitting the folder would mean a second plan opening with "depends on the
  first being done". Explicit boundaries still keep the column drop out of the same commit as a
  stepper restyle.
- **Ordering is load-bearing:** groups must go first or the wizard is written against a column
  about to vanish, and `RecipeArticle`'s prop change must land before the wizard because the
  preview depends on it.
- **Trade-off:** phase 1 alone touches the live public page and drops a column, so it carries
  more risk than the other three combined while sharing their plan and their `progress.md`.
  Whoever runs it should treat the `select count(*)` gate as blocking.
