# Decisions: Recipe schema redesign

## 1. Make `recipe_images.sort_order` unique per recipe

- **Date:** 2026-08-01
- **Considered:** leave it as-is (unique only on `(recipe_id, storage_path)`) · add
  `unique (recipe_id, sort_order)` to match the other two child tables
- **Chosen:** add the constraint. `recipe_steps` and `recipe_ingredients` are both unique on
  their ordering column; `recipe_images` was not, so two images could share a `sort_order` and
  gallery order became arbitrary — worse given `sort_order` defaults to `0`, which makes that
  state the easy one to fall into.
- **Trade-off:** reintroduces the reorder-collision problem for images specifically, because
  images are written incrementally rather than replaced wholesale by the RPC (see decision 10).
  `CLAUDE.md` was also corrected — it had described all three children as unique on their
  ordering column, which was never true.

## 2. Keep the two-role permission model unchanged

- **Date:** 2026-08-01
- **Considered:** add `user_id` to `recipes` and pin write policies to `auth.uid()` · pin
  policies to a single hardcoded owner uuid · leave the model exactly as it is
- **Chosen:** leave it. There are two roles, visitor and admin, and every logged-in account is
  an admin by design. Any admin may create, edit and delete any recipe, so there is no
  per-row condition for a policy to test and no ownership fact to store — `using (true)` is
  the honest expression of the model, not a placeholder.
- **Trade-off:** account creation becomes the only admission control, so signups must stay
  disabled in Supabase Auth and accounts are created by hand. That invariant lives in a
  dashboard setting rather than in code, which is why it is written down. Full write-up and the
  rebuild path if personal accounts are ever added: `docs/permission-model.md`.

## 3. Drive the redesign from the write path, not from a feature wishlist

- **Date:** 2026-08-01
- **Considered:** design against two concrete screens (create/edit form + detail page) ·
  settle the whole eventual feature surface first and migrate once · a correctness-only pass
  that fixes the known defects and changes no structure
- **Chosen:** design against the two screens. The schema was written up front and has almost
  no consumers, so its shape has never been tested by anything — the failure mode was
  redesigning it in the abstract a second time and being wrong in new ways. Tying each
  decision to a screen that will exercise it shortly is what makes them checkable.
- **Trade-off:** anything the two screens don't touch stays unaddressed, so a later feature may
  need its own migration. Accepted — cheap, since there is no data and no `db:diff` drift to
  reconcile.

## 4. One form, one submit — not incremental autosave

- **Date:** 2026-08-01
- **Considered:** one form, one submit, children replaced wholesale · incremental autosave
  where each step/ingredient saves as you add it · hybrid, text batched but images uploaded on
  drop
- **Chosen:** one submit. It keeps the write path a single code path with no partial-state UI
  and no per-row error handling, and it dissolves the ordering problem outright: positions are
  assigned fresh from array index on every save, so there is never an interleaved swap to
  collide with the unique constraint.
- **Trade-off:** "replace the children wholesale" needs a real transaction, which is what
  forced decision 6's RPC — `delete` then `insert` as two HTTP requests can wipe a recipe's
  steps, and `insert`-before-`delete` is blocked by the unique constraint. The hybrid option
  was rejected for now because images are out of scope entirely; it becomes relevant again
  when the bucket lands.

## 5. Take all four content features, with tags built last

- **Date:** 2026-08-01
- **Considered:** each of ingredient groups, prep/cook split, notes, tags independently
- **Chosen:** all four. Groups, the time split and notes are columns on tables that already
  exist, so they are nearly free.
- **Trade-off:** tags are the only one with no screen behind them — the filter UI on
  `/recipes` is explicitly out of scope, so their justification is detail-page display alone.
  They also cost two new tables. Kept because they are purely additive, and built last so
  dropping them stays a one-line change. `published_at` was added on the same "cheap and
  probably useful" reasoning but does **not** meet the screen test either; it is flagged in
  `plan.md` as droppable.

## 6. Relational children with an RPC, not `jsonb` on `recipes`

- **Date:** 2026-08-01
- **Considered:** **A** extend the four tables in place, atomicity via a `save_recipe` plpgsql
  function · **B** the same, but with `ingredient_groups` as its own table · **C** move
  `steps` and `ingredients` into `jsonb` columns on `recipes`, keeping images and tags
  relational
- **Chosen:** A. It keeps every field a real column, so the database goes on validating
  content for every writer — not just the form — and `db:types` goes on generating the types
  that make a schema change a compile error. C would emit `Json` for both columns, forcing
  hand-written shapes and casts, which is exactly what `types/recipes.ts` exists to prevent
  and what already caught a hand-written `description: string` disagreeing with a nullable
  column.
- **Trade-off:** A costs one plpgsql function that cannot be tested without Docker, so it has
  to be pushed and driven through the app. Accepted because the cost is front-loaded and
  one-time — the function is written once and then stops changing — whereas C's cost is
  ongoing: renaming a key inside the blob leaves old rows in the old shape silently and
  forever, with no type error and no migration touching them, in a project that already has no
  drift detection.
- **Note on re-litigation:** `jsonb` for ingredients had already been considered and rejected
  during the initial schema design, on the grounds that the database can't validate inside a
  blob. It was deliberately reopened here because decision 4 was genuine new information — the
  write path had acquired a _correctness_ problem, not just an inconvenience, and `jsonb`
  dissolves it for free. Re-rejected on the type-safety and drift arguments above. Do not
  reopen a third time without something new again.

## 7. Denormalized `group_label`, not an `ingredient_groups` table

- **Date:** 2026-08-01
- **Considered:** a nullable `group_label text` on `recipe_ingredients` (null = ungrouped) ·
  an `ingredient_groups` table with its own `sort_order`, referenced by `group_id`
- **Chosen:** the column. Group order becomes "order of first appearance", and renaming a
  group means updating several rows — both non-problems for an editor where you load one
  recipe into a form and rewrite it whole.
- **Trade-off:** two real costs. Group contiguity becomes a form invariant the database cannot
  enforce, so dragging an ingredient out of its group makes the rendered groups interleave.
  And the normalized version was rejected partly because it would have made the RPC materially
  harder — inserting groups, reading back their ids, then inserting ingredients against them
  is a two-level write inside the function.
- **Superseded 2026-08-01 — the feature is gone, not just the shape of it.** `group_label` was
  dropped from `recipe_ingredients`, its read removed from `save_recipe()`, and
  `hasContiguousGroups` deleted from `lib/recipes/schema.ts`. The choice recorded above was
  between two ways of storing groups; the wizard work decided not to have groups at all, which
  makes the question moot rather than answered differently. Neither option here was wrong —
  keeping an unwritten column would have meant maintaining three pieces of machinery for a
  feature nothing uses. See decision 3 of `docs/plans/admin-create-wizard/decisions.md` and
  migration `20260801190718_remove_ingredient_groups.sql`. The entry above stays as written
  because it records what was true when it was decided.

## 8. Notes at both recipe and step level

- **Date:** 2026-08-01
- **Considered:** `recipes.notes` only · both `recipes.notes` and `recipe_steps.note`
- **Chosen:** both. Recipe-level carries asides about the dish and substitutions; step-level
  carries warnings that belong to one step. The second is one nullable column on a table
  already being altered, so it is nearly free.
- **Trade-off:** one more field per step row for the form to render and edit.

## 9. No generated `total_minutes` column

- **Date:** 2026-08-01
- **Considered:** drop `time_minutes` and add `prep_minutes` + `cook_minutes` only, computing
  any total in TS · additionally add `total_minutes` as a stored generated column so SQL can
  sort on it
- **Chosen:** no generated column. The generated version forces a null-semantics decision
  before anything needs it: with `coalesce`, a recipe with no times recorded reports a total of
  `0`, so `0` means both "no time needed" and "never filled in"; without `coalesce`, one
  missing component makes the whole total null.
- **Trade-off:** sorting or filtering by total time has to compute `prep + cook` in the query
  or in TS. Irrelevant at this scale, and the generated column remains available later once a
  real list-page requirement decides which null semantics it wants.

## 10. Images excluded from `save_recipe` v1

- **Date:** 2026-08-01
- **Considered:** handle all four child tables in the RPC from the start · cover recipe,
  ingredients, steps and tags only, leaving images for the Storage work
- **Chosen:** exclude images. No bucket exists, Storage has a separate policy system with
  nothing configured, and the upload questions are genuinely open — see
  `docs/image-storage.md`. Designing the image half of the write path now would mean guessing
  at all of it.
- **Trade-off:** the write path ships incomplete, and it means images keep being written
  row-by-row rather than replaced wholesale — which is precisely why decision 1's constraint
  will collide on reorder. Both the constraint question and the file-orphan question are
  deferred to the same later piece of work, deliberately, so they get decided together.

---

Decisions 11 onward came out of grilling the plan for execution, after 1–10 had settled the
design. They are implementation choices, not schema ones, except where noted.

## 11. Form state in `useState`, submitted as one hidden JSON field

- **Date:** 2026-08-01
- **Considered:** client state serialised into a single hidden `payload` input · plain
  `FormData` with indexed field names (`ingredients.0.name`) reassembled server-side · adding
  `react-hook-form` + `@hookform/resolvers` for `useFieldArray`
- **Chosen:** the hidden JSON field. It adds no dependency, and the array held in client state
  _is_ the jsonb the function wants — one shape from form state through zod to SQL, with array
  position as the ordering at every stage and nothing to translate. Indexed `FormData` names
  were rejected because deleting a middle row leaves gaps and reordering means rewriting every
  field name; `react-hook-form` because two dependencies and a divergence from the plain
  `useActionState` pattern in `lib/auth/actions.ts` buy little for one admin form.
- **Trade-off:** the form requires JavaScript — no progressive enhancement. Irrelevant for an
  owner-only admin screen. Client-side validation is also given up; zod on the server stays the
  only validator, which matches every other action in the project.

## 12. `payload.id` discriminates create from update

- **Date:** 2026-08-01
- **Considered:** an `id` in the payload, absent meaning insert · `insert … on conflict (slug)
do update` · two separate functions `create_recipe` / `update_recipe` over a shared private
  helper
- **Chosen:** the `id`. It keeps `slug` as ordinary data, which is the only option of the three
  where **renaming a slug works** — upserting on slug conflict would fork a second recipe and
  orphan the first. Two functions were rejected as three functions' worth of maintenance for a
  four-line branch.
- **Trade-off:** the edit form must carry a hidden `id`, and a slug collision now surfaces as
  SQLSTATE `23505`, which the action has to translate into a readable message instead of
  leaking a Postgres error.

## 13. Draft preview is a separate uncached route under `/admin`

- **Date:** 2026-08-01
- **Considered:** a second route under `/admin` reading with the server client · no preview at
  all, publish to look · one public route that falls back to an authenticated read when the
  cached anon read misses
- **Chosen:** the separate route. The public detail page must use the public client inside
  `"use cache"`, which is always `anon`, which RLS limits to published rows — so a draft is
  invisible on its own public URL even to the owner. A second uncached route sees drafts
  without touching the public one.
- **Trade-off:** the rendering logic is used by two routes, so it belongs in a shared component
  rather than in the page. The fallback option was rejected outright: deciding on the basis of
  a cookie makes the route dynamic for _every_ visitor, so `/recipes/[slug]` would lose its
  cache entirely to serve a preview used twice a month.

## 14. One broad cache tag, not per-slug tags

- **Date:** 2026-08-01
- **Considered:** `cacheTag("recipes")` on both reads, `updateTag("recipes")` on write · an
  additional per-slug tag for precision
- **Chosen:** the broad tag alone. The broad tag is needed regardless — for the list page, and
  because **a slug rename depends on it**: the old slug's cached entry has to die or that URL
  keeps serving the old recipe until the 15-minute window lapses. Given that, per-slug tags
  only save re-querying unrelated detail pages.
- **Trade-off:** any save invalidates every recipe page. At a few dozen recipes that is a
  re-query, not a problem; revisit if the catalogue grows by an order of magnitude.

## 15. Tags leave this plan entirely

- **Date:** 2026-08-01
- **Considered:** this plan creates `tags` + `recipe_tags` and the other session builds only
  the UI · this plan also builds the recipe-side selector · tags leave this plan completely
- **Chosen:** they leave completely. Tags are being designed in their own session, which will
  have opinions about the table itself — colour, grouping, ordering, hierarchy. Creating
  `tags (id, slug, label)` here would pin that design before it is made and invite a
  reconciliation migration. This narrows decision 5 rather than reversing it: tags were already
  recorded as purely additive and built last precisely so this was cheap.
- **Trade-off:** two migrations instead of one, and the recipe form ships with no tag input.
  The seam is safe because `save_recipe` takes a single `jsonb` argument, so
  `coalesce(payload->'tag_ids', '[]')` can be added later without breaking existing callers.

## 16. Drop `published_at`

- **Date:** 2026-08-01
- **Considered:** keep it, on the grounds that a publish date is unrecoverable once a recipe is
  already published · drop it until something displays it
- **Chosen:** drop it. Decision 5 flagged it as failing the same "must have a screen" test that
  tags were held to, and consistency won. It is one nullable column, addable in a two-line
  migration.
- **Trade-off:** the real publish moment for anything published before that migration is lost —
  a backfill would have to guess from `created_at`. Accepted knowingly. This also resolves the
  plan's old open question about `getRecipes()` ordering: with no `published_at`, there is
  nothing new to order by and it stays `created_at`.

## 17. `ALTER` migration, not another drop-and-recreate

- **Date:** 2026-08-01
- **Considered:** a small `ALTER` delta · restate the whole schema in a fresh file, the way the
  initial migration handled the Table Editor tables
- **Chosen:** the `ALTER` delta. Drop-and-recreate was right the first time because it replaced
  hand-built tables with no history; now the tables carry RLS policies and grants that a
  recreate would have to restate in full, leaving two migrations that both define `recipes` and
  a reader who has to know the later one wins.
- **Trade-off:** the migration reads as a diff rather than a picture of the schema. Mitigated by
  `docs/schema-current.html`, which is the picture.

## 18. Up/down buttons for reordering, not a drag-and-drop dependency

- **Date:** 2026-08-01
- **Considered:** up/down buttons swapping array positions · adding `@dnd-kit/core` +
  `@dnd-kit/sortable`
- **Chosen:** buttons. With decision 11's client state the swap is a few lines, it works on
  touch without gesture handling, and it is keyboard-accessible for free. A recipe has perhaps
  ten ingredients, which is not a list that needs dragging.
- **Trade-off:** moving an item several positions takes several clicks, and it looks plainer.
  `@dnd-kit` remains a drop-in upgrade later because the underlying operation is the same array
  move.

## 19. This slice is create-only

- **Date:** 2026-08-01
- **Considered:** ship create plus edit, including a real `/admin/manage` list · ship create
  only
- **Chosen:** create only, at the owner's request to keep the session narrow. `/admin/manage`
  stays a placeholder.
- **Trade-off:** recipes can be written but not corrected through the UI until edit lands —
  fixes have to go through the Supabase Table Editor in the meantime. Cheap to close, because
  decision 12's `id` branch means edit is a UI-only addition with no schema or function change.

## 20. Slug auto-derived from the title, but editable

- **Date:** 2026-08-01
- **Considered:** slugify the title client-side into an editable field · type the slug by hand
  every time
- **Chosen:** auto-derived and editable. The `check` constraint already rejects anything
  malformed, so the generated value is almost always right and the override handles the rest.
- **Trade-off:** once editing exists, the auto-sync has to stop for saved recipes — otherwise
  fixing a typo in a title silently changes a live URL. Noted here because it is easy to miss
  when edit is built later.
