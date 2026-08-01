# Progress: Recipe Creator wizard

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

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
- **Cost an hour, and would cost it again: a brand-new file's Tailwind classes do not exist until
  `.next` is cleared.** Turbopack's dev cache does not invalidate Tailwind's source scan when a
  file is _created_ (editing an existing one is fine). `bg-difficulty-hard-bg` was in the
  rendered `class` attribute and had no rule behind it; restarting `next dev` twice changed
  nothing; `git add`-ing the file changed nothing. `npm run build` generated all twelve
  utilities correctly, which is what proved the code right and the dev cache wrong.
  `rm -rf .next` fixed dev. Written into `CLAUDE.md` under dependency gotchas, because phase 4
  adds several new files at once and will hit it again.
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
