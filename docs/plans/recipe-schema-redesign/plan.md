# Plan: Recipe schema redesign

## Goal

Reshape the recipe schema so the two screens that need it can actually be built: the create
form at `/admin/create`, and a recipe detail page at `/recipes/[slug]` (which does not exist
yet). Along the way the schema gains the three things a recipe page needs and currently can't
express — ingredient groups, a prep/cook time split, and notes.

Done now because the schema has almost no consumers. The app reads `title` and `description`
and nothing else; `recipe_steps`, `recipe_ingredients` and `recipe_images` have zero readers;
and there is no data worth preserving. It is the cheapest this change will ever be, and every
decision here gets tested by a real screen shortly after it lands.

## Non-goals

- **Tags, in full.** Tables, management page and recipe-form selector are all being designed
  in their own session, which owns the whole vertical. `save_recipe` takes a single `jsonb`
  argument specifically so `payload.tag_ids` can be added later without breaking callers.
- **Image uploads and the Storage bucket.** No bucket exists, Storage has its own policy
  system, and the questions are genuinely open — see `docs/image-storage.md`. `save_recipe`
  deliberately stops at the edge of this. **The detail page therefore ships with no images.**
- **Editing existing recipes.** Create only. `save_recipe` still gets its create/update
  branch, so edit is a later UI-only addition with no schema or function change.
  `app/admin/manage/page.tsx` stays a placeholder.
- **Any change to the permission model itself.** Two roles, no ownership column, no
  `auth.uid()` pinning — see `docs/permission-model.md`.
- **Personal or non-admin accounts.** Every logged-in account stays an admin.
- **Reworking `components/feature/` vs `components/shared/`.** Out of scope even though the
  new detail page touches that boundary.

## Context

**What exists.** Four tables from `supabase/migrations/20260801122716_initial_schema.sql`,
diagrammed in `docs/schema-current.html`. `recipes` has ten columns; the three child tables
hang off it with `on delete cascade`. RLS is enabled on all four with explicit policies and
grants.

**What consumes it.** Almost nothing. `lib/recipes/queries.ts` exposes a single `getRecipes()`
that selects `*` with no `published` filter — RLS is what limits a visitor to published rows,
not the query — and `components/shared/RecipeCard.tsx` renders `title` and `description` only.
There is no `/recipes/[slug]` route, so `slug` currently addresses nothing. Both
`app/admin/manage/page.tsx` and `app/admin/create/page.tsx` are placeholder cards.
`lib/recipes/` is missing `actions.ts` and `schema.ts` because the write path was removed.

**Verified before planning:** nothing in `app/`, `components/` or `lib/` reads
`time_minutes`. Dropping it breaks no readers, so `npm run typecheck` passing straight after
the migration is a real signal rather than a formality.

**Conventions to follow.** `CLAUDE.md` covers these and they are not restated here: the
three-file domain module shape, which Supabase client to use where, the `"use cache"` +
`cacheTag` pattern and `updateTag` vs `revalidateTag`, the migration loop, the import-comment
grouping, and prettier's settings.

**Constraints specific to this work.**

- **No data worth keeping** (confirmed), but the migration is still written as an `ALTER`
  delta rather than a drop-and-recreate — the tables now carry RLS policies and grants worth
  not restating.
- **zod is v4.** `lib/auth/schema.ts` already uses v4 syntax (`z.email()`, not
  `z.string().email()`). Don't copy a v3 snippet.
- **No form-array tooling is installed** — no `react-hook-form`, no `@dnd-kit`, and no
  `components/ui/form.tsx`. This plan adds **zero dependencies**; see decisions 11 and 18.
- **Docker is unavailable**, so `db:diff` and `db:pull` don't work and there is no local
  Postgres. There is no drift detection, and the function cannot be exercised locally.
- **RLS is the real boundary**, not `requireUser()`. The publishable key ships to every
  browser.

## Approach

Extend the existing four tables in place rather than collapsing the children into `jsonb` on
`recipes`. New content becomes ordinary columns, so the database keeps validating it (`check`
constraints, uniques, foreign keys) and `db:types` keeps generating its types — the two
properties this project was deliberately built around. `types/recipes.ts` derives from the
generated types precisely so a column change surfaces as a compile error, and a `jsonb` blob
would return that guarantee to hand-written types and casts.

The form saves everything in one submit, which means each save replaces a recipe's whole set
of children. That is where the real design problem sits: Supabase JS issues each statement as
its own HTTP request and therefore its own transaction, so a `delete` that succeeds followed
by an `insert` that fails leaves a recipe with no steps. Inserting before deleting is not an
escape, because `unique (recipe_id, sort_order)` makes new rows collide with the old ones
still present.

So the write goes through a single Postgres function, `save_recipe(payload jsonb)`, which does
the upsert and all the child replacement inside one transaction. **jsonb is the transport, not
the storage** — nothing is stored as a blob, and every row stays typed and constrained. A
useful consequence: because each save rewrites a child set from scratch, `sort_order` and
`step_number` come straight from array position via SQL's `with ordinality`, so reordering in
the UI needs no special handling at all.

One shape carries the whole write path. The form holds ingredients and steps as arrays in
client state; on submit they are serialised into a single hidden `payload` field; the action
`JSON.parse`s it, validates with zod, and passes it straight to the function as `jsonb`.
Array position is the ordering at every stage, so nothing has to translate between
representations.

**Sequencing matters more than usual here.** Build the read path before the write path: apply
the migration, hand-insert one recipe with children through the Supabase SQL editor, then
build `/recipes/[slug]` against that real row. The detail page is then proven before the form
exists, so when the form misbehaves it is unambiguously the form. Verifying the function has
its own wrinkle — see Risks.

Alternatives and the reasoning that rejected them are in `decisions.md`; the relational-vs-jsonb
comparison is rendered in `assets/schema-options-a-vs-c.html`.

## Components

- **`supabase/migrations/<new>.sql`** — an `ALTER` delta, roughly twenty lines. On `recipes`:
  drop `time_minutes`, add `prep_minutes` and `cook_minutes` (`check (> 0)`) and `notes`. On
  `recipe_ingredients`: add `group_label text`. On `recipe_steps`: add `note text`. On
  `recipe_images`: add `unique (recipe_id, sort_order)`. No RLS, policy or grant changes — no
  new tables means nothing new to protect.

- **`save_recipe(payload jsonb) returns bigint`** — branches on `payload->>'id'`: absent means
  insert, present means update. Slug is ordinary data, so renaming one is just an update. Then
  per child table, delete by `recipe_id` and re-insert from the payload array, taking position
  from `with ordinality`. Three things that must be right:
  - `security invoker`, **not** `security definer`. Most Supabase RPC examples online use
    `definer`, which runs as the function owner and bypasses RLS entirely — that would be a
    write path straight past every policy.
  - `set search_path = ''`, matching `set_updated_at()`, so every name inside is fully
    qualified and nothing can be shadowed.
  - `revoke execute` from `anon` and `public`, grant it to `authenticated`. Functions are
    broadly executable by default; an unrevoked one is a hole regardless of RLS.

  Images and tags are **not** handled here — see Non-goals. Those are the seams the bucket
  work and the tag session plug into.

- **`types/database.ts`** — regenerated with `npm run db:types`. Not hand-edited. It already
  has a `Functions` block, so the function arrives typed: `Args: { payload: Json }`,
  `Returns: number`. This is the project's first `.rpc()` call.

- **`lib/recipes/schema.ts`** (new) — zod schemas for the payload, including the nested
  ingredient and step arrays, plus the `useActionState` state type. Normalises empty strings
  to `null` (see Risks). This file defines the shape `save_recipe` parses, so the two are a
  contract.

- **`lib/recipes/actions.ts`** (new) — `"use server"`. `saveRecipe(prevState, formData)` reads
  the single `payload` field, `JSON.parse`s it, validates with zod, calls `requireUser()`,
  invokes the function via the server client, calls `updateTag("recipes")`, and redirects.
  Returns `{ error?: string }` on failure like `lib/auth/actions.ts` does, and maps SQLSTATE
  `23505` to a slug-already-taken message rather than leaking a Postgres error.

- **`lib/recipes/queries.ts`** — gains two reads, deliberately not one:
  - `getRecipeBySlug(slug)` — public client, `"use cache"`, `cacheTag("recipes")`. Anon, so
    published recipes only.
  - `getDraftBySlug(slug)` — server client, **not** cached, for the admin preview. Cookie-backed
    so it sees drafts. Cannot be cached; reading cookies inside `"use cache"` is illegal.

- **`app/recipes/[slug]/page.tsx`** (new) — the public detail page. Renders ingredients grouped
  by `group_label` in first-appearance order, steps with their notes, the prep/cook split and
  the recipe note. `notFound()` when the slug misses.

- **`app/admin/preview/[slug]/page.tsx`** (new) — the same rendering against `getDraftBySlug`,
  so a draft can be looked at before publishing. Under `/admin`, so `AdminGate` already covers
  it.

- **`app/admin/create/page.tsx`** — replaces the placeholder with the real form: repeatable
  ingredient and step rows with up/down reordering and a remove button, group labels, the
  prep/cook fields, notes, and a slug field auto-filled from the title but editable.

## Risks

- **A function that passes in the SQL editor can still fail from the app.** The Supabase
  dashboard SQL editor runs as a privileged role, not as `authenticated`, so `security
invoker` and the RLS policies are not exercised there. Verify **logic** in the editor and
  **permissions** through the app; treating an editor success as proof is the trap.

- **Empty string is not null.** An untouched `amount` input submits `""`, which must become
  `null` — not `0`, not `NaN`. `group_label` is worse: `""` would render an ingredient group
  with a blank heading. The zod schema is the single place to normalise this, and it applies
  to `unit`, `description`, `notes` and step `note` too.

- **The ordering collision survives for images.** Steps and ingredients are safe because the
  function replaces whole sets. Images are written incrementally as uploads land, so
  reordering a gallery patches rows in place and the new `unique (recipe_id, sort_order)` will
  collide — exactly `docs/known-issues.md` issue 1, relocated. Mitigation is either
  `deferrable initially deferred` on that one constraint, or having the gallery editor replace
  the whole set too. Unresolved on purpose; it belongs with the bucket work, and
  `known-issues.md` should be updated to say the issue now applies to images only.

- **Group contiguity is a form invariant the database cannot enforce.** `group_label` with
  "group order = order of first appearance" only renders correctly while a group's ingredients
  stay contiguous. Move one row out of its group and the rendered groups interleave. The form
  has to prevent it; nothing in the schema will. Accepted as the price of not adding an
  `ingredient_groups` table.

- **The payload shape is hand-synced** between `lib/recipes/schema.ts` and the SQL function.
  This is a small version of the drift problem that argued against `jsonb` — confined to one
  function rather than spread through the data, but real. Keep the zod schema and the
  function's field list adjacent in review.

- **The function cannot be tested locally.** No Docker means no shadow database. Mitigation:
  push a trivial version of `save_recipe` early and grow it, rather than writing it whole and
  debugging through the form.

- **A generated column was declined**, so any "sort by total time" feature must compute
  `prep + cook` in the query or in TS. Fine at this scale; revisit if the list page needs to
  sort or filter on it in SQL.

## Open questions

- **Image reordering:** `deferrable` constraint, or whole-set replace for the gallery too?
  Decide with the bucket work, not before.
- **Where the slugify helper lives** — inline in the form component, or `lib/utils.ts`
  alongside `cn()`. Trivial either way; decide when writing it.

## Assets

- [schema-options-a-vs-c.html](assets/schema-options-a-vs-c.html) — the decision sheet that
  settled the approach: schema shape, save path with transaction boundaries, generated vs
  hand-written types, what each option lets the database refuse, and an 11-row comparison
  matrix.
- `docs/schema-current.html` (left in place, not copied here) — the schema as it stands today,
  kept as a standing project reference rather than a plan artifact.
