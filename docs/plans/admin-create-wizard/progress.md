# Progress: Recipe Creator wizard

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-01 — Correction: the Tailwind "new file" gotcha was misdiagnosed

Phase 2 concluded that Turbopack's dev cache does not invalidate Tailwind's source scan when a
file is _created_, and that went into `CLAUDE.md`. Re-tested afterwards on a clean tree, and it
is **not reproducible**: a brand-new component file containing an otherwise-unused utility had
its rule in the served CSS within seconds, with no restart and no page request. Adding a novel
class to an already-scanned file works hot too.

Two measurement mistakes made it look otherwise. The first probe run compared against a stale
response and reported `.bg-primary` missing as well, which should have been the tell. The
follow-up probes used arbitrary-value classes like `tracking-[0.37em]` and grepped for
`tracking-\[0\.37em\]` — but a CSS class selector escapes `[`, `]` and `.`, so the file contains
`tracking-\[0\.37em\]` with backslashes and the pattern never matched. Both classes had been
generated the whole time. **Probe with plain unescaped utilities (`line-through`) rather than
arbitrary-value ones, or the test lies.**

What survives: the original symptom was real — the difficulty utilities genuinely were absent
from dev CSS while present in the production build, and `rm -rf .next` fixed it. The mechanism is
just "that `.next` was sick", and notably it was the same `.next` that had produced the
dead-worker 500s in phase 0. `CLAUDE.md` now says that instead, and explicitly warns against
clearing `.next` as a habit.

## 2026-08-01 — Phase 4: the wizard

- **Did:** `recipeSchema` split into `detailsSchema` / `ingredientsSchema` / `stepsSchema`,
  composed back by spreading `.shape`. New `app/admin/_components/recipe-wizard/` — `draft.ts`
  (state shape, sanitisers, the two mappings), `RecipeWizard.tsx` (state owner), `Stepper`,
  four panels, `PreviewRail`, `RowControls`, `PanelNav`. `RecipeForm.tsx` deleted.
  `create/page.tsx` renders the wizard and keeps its `Suspense`. Docs: `CLAUDE.md` gains a
  wizard section, `README.md`'s Planned Features pruned to what is genuinely pending,
  `docs/known-issues.md` gains the refresh entry.
- **Open question resolved — one file or several.** Several. One file would have been ~700 lines
  and the panels share almost nothing but the draft, which is threaded down as `draft` plus a
  single `onPatch`. There is no context and no reducer; the state owner is one `useState`.
- **Open question resolved — how the preview emphasises the current step.** Scroll only; the
  mockup's dimming is dropped. Dimming two thirds of a preview reads as broken rather than
  focused, and implementing it meant either giving the shared `RecipeArticle` a wizard-shaped
  prop or styling its internals from outside. The scroll targets `#ingredients-heading` and
  `#steps-heading`, which are `RecipeArticle`'s own `aria-labelledby` ids and therefore part of
  its markup rather than something reached into.
- **`useActionState` sits in the wizard root, not in the Review panel.** A slug collision has to
  send the user back to Details to change the title, which unmounts Review — and would take the
  error message with it. The `<form>` element still lives only in Review, which is what
  decision 12 is actually about. Consequence recorded in `CLAUDE.md`: the page's `Suspense`
  boundary has to cover the whole wizard, not just the panel with the form in it.
- **`RecipeFormState` gained `takenSlug`.** Decision 11 needs the form to know a failure _was_ a
  collision, not just that something failed. It holds the slug rather than a boolean so the
  warning clears itself — the wizard compares it against the slug the current title derives, and
  one keystroke makes them differ.
- **Found and fixed while testing: a blank row was a dead end.** Clicking "Add ingredient" and
  then navigating away leaves an empty row; `ingredientsSchema` rejects it, so the step un-ticks
  and Review re-locks with only the generic banner to explain it. That is the same shape of
  problem as the unsluggable title, and it gets the same answer — the panel now says "Every
  ingredient needs a name. Fill the empty row in, or remove it with ✕." Same on Steps. Not
  fixed by dropping blank rows in `toPayload`, which would tick green while a row visibly on
  screen silently vanished on save.
- **Verified.** `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format:check`.
  There is no browser automation here, so the interactive behaviour was checked two ways.
  A throwaway route handler inside the app (`/dev/wizard-check`, since deleted) exercised the
  pure logic where the `@/` aliases resolve:
  - sanitisers — `digitsOnly` strips `-`, `.` and letters; `amountChars` keeps digits and at most
    one of `. , /`
  - `parseAmount` — `1/2`→0.5, `0,5`→0.5, `3/4`→0.75, and `1/` · `.` · `0/0` → null
  - the tick is honest — `prep_minutes: "abc"` and `"0"` both leave Details un-ticked, which is
    the exact bug decision 2 exists to prevent
  - decision 10 — a title of `"№ 🍌 «»"` gives `slug: ""` and Details does not tick, while
    `"Gestoofde Bakbanaan Crème"` gives `gestoofde-bakbanaan-creme`
  - a complete draft ticks all three, and `recipeSchema` normalises it to exactly what
    `save_recipe()` wants

  Then the panels themselves, by seeding the wizard's initial step and draft, loading the page and
  reading the markup back — reverted afterwards. Step 1 with an empty draft shows the new blank-row
  hint and a locked Review; step 2 shows the preview rail and the "all three complete" banner, and
  **zero `<form>` elements on the page**, which is decision 12 confirmed rather than assumed;
  step 4 shows the checklist, the publish switch, the hidden payload field carrying the right JSON,
  and the full article underneath with `½ tl kaneel` and the difficulty badge.

  Finally the whole contract end to end: the exact payload the wizard produces, fed to
  `save_recipe()`, returned an id, and `/recipes/gestoofde-bakbanaan` renders it — `1/2` typed
  and `0,5` typed both coming back as `½`.

- **Not verified, and worth a real click-through:** focus behaviour, the smooth scroll in the
  preview rail, and how the layout actually looks. Everything above is markup and logic.
- **Cleanup done:** `zzz-phase1-smoke` and the `gestoofde-bakbanaan` round-trip recipe were both
  deleted from the database.

## 2026-08-01 — Phase 3: RecipeArticle takes a view, not a row

- **Did:** `RecipeView` in `types/recipes.ts`; `toRecipeView()` exported from
  `RecipeArticle.tsx`; both database-backed pages map through it. List keys are the array index
  and step numbers are `index + 1`.
- **Open question resolved — where the mapper lives.** Not `types/recipes.ts`, which is pure
  types and would become a runtime module; not `lib/recipes/`, because `CLAUDE.md` says a domain
  folder is exactly three files and a mapper is none of them. It sits beside the component it
  adapts for, which both callers already import.
- **`RecipeView` is built with `Pick`, not restated fields.** The subset is a real design choice
  — it is what the article renders — but the _types_ of those fields still come from the
  generated row aliases, so a column that turns nullable cannot quietly disagree here. That is
  the failure `types/recipes.ts` already warns about, and hand-writing
  `description: string | null` would have walked straight back into it.
- **Decision 8's constraint is now a comment at the top of `RecipeArticle`.** The wizard imports
  it, so it is in the client bundle; `next/headers`, `cookies()` and the Supabase server client
  are off-limits in that file from here on. Nothing enforces it.
- **Verified:** `npm run lint`, `npm run typecheck`, `npm run format:check`. Rendered
  `/recipes/zzz-phase1-smoke`, `/admin/preview/zzz-phase1-smoke` and
  `/recipes/hutspot-met-klapstuk` (a recipe with no children at all, to check the empty case) —
  all 200, ingredient order and step numbering unchanged from phase 2.
- **Next:** phase 4.

## 2026-08-01 — Phase 2: DifficultyBadge, tokens, fraction glyphs

- **Did:** six `--difficulty-*` tokens in `:root` and `.dark`, exposed through `@theme inline` as
  `--color-difficulty-*` so they are reachable as ordinary utilities. New
  `components/shared/DifficultyBadge.tsx`. Both call sites: `RecipeArticle`'s flat
  `<Badge variant="secondary">`, which painted all three difficulties the same green, and
  `RecipeRow`'s Difficulty field, which was plain capitalised text. `formatAmount()` in
  `RecipeArticle` gained fraction glyphs.
- **The badge map is typed `Record<RecipeDifficulty, string>` on purpose.** A fourth difficulty
  then fails to compile here rather than rendering an unstyled pill — the enum is generated, so
  adding a value and running `db:types` is what trips it.
- **Cost an hour: the dev CSS was missing the difficulty utilities.** `bg-difficulty-hard-bg` was
  in the rendered `class` attribute with no rule behind it; restarting `next dev` twice changed
  nothing, `git add`-ing the new file changed nothing. `npm run build` generated all twelve
  utilities correctly, which proved the code right and the dev cache wrong. `rm -rf .next` fixed
  it.

  **Corrected after the fact — see the entry below dated the same day.** The explanation first
  written here and into `CLAUDE.md` was "Turbopack does not invalidate Tailwind's source scan when
  a file is _created_". That is wrong, and re-testing disproved it. What is true: a `.next` can go
  bad in a way that drops utilities, `rm -rf .next` fixes it, and the production build is how you
  tell. Worth noting the `.next` in question was the same one that had produced the dead-worker
  500s at the start of the session.

- **Verified:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format:check`.
  Rendered `/admin/preview/zzz-phase1-smoke` — chosen because that route is uncached, so a direct
  database write shows up without a cache dance. Every glyph case: `½ tl`, `¼ el`, `¾`,
  `⅓ kop` (from 0.3333…), `⅔ kop`, `1½ l`, `0.4 g` left alone because it has no clean fraction,
  `400 ml` unchanged, and an ingredient with no amount rendering as its name only. The `hard`
  badge resolves to `color-mix(in oklab, var(--difficulty-hard) 30%, transparent)` for its border,
  with the flat-colour fallback above it.
- **Next:** phase 3.

## 2026-08-01 — Phase 1: ingredient groups removed

- **Did:** `20260801190718_remove_ingredient_groups.sql` — gate, then `save_recipe()` without
  `group_label`, then the column drop. Regenerated `types/database.ts`. Removed `group_label`
  from `ingredientSchema` and deleted `hasContiguousGroups` with its `.refine`; deleted
  `groupIngredients()` from `RecipeArticle` and flattened the list; removed the Group input from
  `RecipeForm` (deleted in phase 4, but phase 1 has to leave the tree compiling). Docs: the
  `recipe_ingredients` line in `CLAUDE.md`, and a superseding note appended to decision 7 of
  `recipe-schema-redesign`.
- **The gate is in the migration, not just in the log.** The count was run and returned 0, but a
  human step that has to be remembered is not a guard — a `do $$ … raise exception $$` block runs
  first and aborts before either destructive statement if any row still carries a label. It also
  protects a replay against a restored database, which the dashboard query never could.
- **`hasContiguousGroups` had a NUL byte in it.** The "distinct key for ungrouped" was
  `"\0ungrouped"` — a literal `\0` in the source, presumably so no user-typed label could collide
  with it. It reads as a space in every editor and it made the file match as binary to ripgrep.
  Gone with the function; noted because it was invisible.
- **Verified:** `npm run lint`, `npm run typecheck` (the drop broke `RecipeArticle` and nothing
  else — see the caveat below), `npm run format:check`. Then a real write:
  `save_recipe()` called with a three-ingredient, two-step payload returned an id, and
  `/recipes/zzz-phase1-smoke` renders the flat ingredient list in `sort_order` and the steps
  numbered from `step_number`.
- **Caveat on "the drop breaks every reader".** It broke exactly one: `RecipeArticle`, which
  reads the generated row type. It did **not** break `ingredientSchema` (an extra key in a zod
  object is not a type error) or `RecipeForm` (`IngredientRow` is a hand-written local type).
  Both had to be found by grep. Typecheck is a good net for anything typed off `types/database.ts`
  and no net at all for anything that restates the shape by hand.
- **Left behind on purpose:** the recipe `zzz-phase1-smoke` is published test data, kept because
  its `0.5 tl kaneel` is what phase 2's fraction glyphs and phase 3's mapper need something real
  to render. **Delete it after phase 4.**
- **Next:** phase 2.

## 2026-08-01 — Phase 0: the open question, closed

- **Did:** diagnosed the "neither recipe page renders" report from `c65bf67` and re-enabled the
  manage table's view/preview action.
- **Finding: both pages were always fine.** `/recipes/[slug]` and `/admin/preview/[slug]` each
  return 200 and render the full article. The 500s the previous session saw came from a dev
  server whose render workers had died — the only thing in the log was
  `Error: Jest worker encountered 2 child process exceptions, exceeding retry limit`, which is
  the worker crashing, not the route throwing. Restarting `next dev` fixed all three slugs with
  no code change. Reproduced the failure against the stale process and the success against a
  fresh one.
- **The trap, since it will happen again:** that error swallows whatever actually threw, and it
  is sticky — once the workers are gone every route 500s, so the symptom looks like "this page
  is broken" rather than "this server is broken". Restart `next dev` before believing a 500.
- **Consequence for the plan:** phase 3 has nothing to repair. It changes how both pages receive
  their data, as written, and the live preview inherits a working `RecipeArticle` rather than a
  broken one. `saveRecipe`'s redirect to `/admin/preview/${slug}` lands somewhere that works.
- **Also worth knowing:** all three published recipes render with **empty** Ingredients and
  Method sections, because `recipe_ingredients` and `recipe_steps` are genuinely empty. That is
  data, not a bug — the three seed recipes were written as `recipes` rows only. There is nothing
  to look at in those sections until the wizard writes something.
- **Verified:** `npm run lint`, `npm run typecheck`, `npm run format:check`, plus fetching all
  three slugs and `/admin/preview/appelmoes`.
- **Next:** phase 1.

### Phase 1 gate — answered, and it passes

`select count(*) from recipe_ingredients where group_label is not null` returns **0**. The whole
child-table space is empty:

| table                | rows                     |
| -------------------- | ------------------------ |
| `recipes`            | 4 (3 published, 1 draft) |
| `recipe_ingredients` | 0                        |
| `recipe_steps`       | 0                        |
| `recipe_images`      | 0                        |

Dropping `group_label` destroys nothing.

**How this was run without Docker and without the dashboard:** `npx supabase db query --linked
"<sql>"`. The CLI is linked and authenticated, and that subcommand goes through the Management
API — the same path the SQL editor uses — so it needs neither Docker nor a shadow database. The
plan assumed this had to be a human step in the dashboard; it does not. Worth remembering as the
Docker-free way to inspect _data_, next to `npm run db:types` for inspecting _schema_.
