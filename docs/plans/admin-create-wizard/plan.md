# Plan: Recipe Creator wizard

> **Superseded in part — historical record, not current guidance.** Ingredient groups were removed
> in `c2c231d` (2026-08-01), so the nine mentions of `group_label` / grouped ingredients below
> describe UI and schema that **no longer exist** — the Ingredients step has no grouping. Everything
> else shipped as written (`ee36175`). CLAUDE.md links here for wizard reasoning, so read it with
> that caveat; the four load-bearing invariants are restated current in
> [CLAUDE.md](../../../CLAUDE.md).
>
> **Docker has since been installed (2026-08-08).** "There is no drift detection… `db pull`, `db diff`
> and `db dump` all fail" below was true when written and no longer is — `npm run db:diff` works. The
> `select count(*)` gate it justifies is still worth having, for the reason given.
> See [toolchain.md](../../toolchain.md).
> _Banner added 2026-08-02 during the docs audit, extended 2026-08-08; prose left untouched on purpose._

## Goal

Replace the single scrolling form at `/admin/create` with a four-step wizard — **Details ·
Ingredients · Steps · Review & Publish** — carrying a live preview of the recipe as it will
appear once published. A stepper across the top shows which sections are complete and keeps
Review locked until they all are.

Two things ride along because the wizard cannot be built cleanly without them: **ingredient
groups are removed** from the product and the schema, and **`RecipeArticle` stops requiring
database rows** so a draft can be rendered without fabricating ids.

The write path does not change. `save_recipe()` remains the only way a recipe is written, the
whole recipe is still one submit, and array position is still the stored order.

## Non-goals

- **The edit route.** Still unbuilt. The wizard is placed and shaped so edit can reuse it, and
  decision 9 settles how the slug behaves when it lands — but nothing here renders it.
- **Category and cuisine.** The reference layout this was modelled on has both; we have neither
  column. Adding them is a migration, not a form change.
- **Images.** No Storage bucket exists — `docs/image-storage.md`. `image_path` stays null and no
  upload control appears anywhere.
- **Notes.** The column stays and `save_recipe` still reads it; the form simply sends null.
  Deferred, not removed. See decision 16.
- **Tags.** `/admin/tags` is a placeholder with no schema behind it. Owned by its own session.
- **Autosave, `beforeunload`, refresh recovery.** Explicitly out — decision 14. Logged in
  `docs/known-issues.md` as part of phase 4.
- **A `slug_history` redirect table.** Considered and deferred in decision 9. Renaming a
  published recipe's title still 404s its old URL.

## Context

`CLAUDE.md` covers the conventions this follows without restating them: the `lib/<domain>/`
three-file shape, which Supabase client belongs where, the `"use cache"` / `updateTag` split,
the two-role permission model, and — most relevant here — the `cacheComponents` rules that make
`Suspense` load-bearing rather than decorative. Read that section before touching
`app/admin/create/page.tsx`.

What is specific to this change:

**The schema is already built for edit.** `recipeSchema.id` is annotated "absent on create,
present on edit"; `save_recipe` branches on it and its update path writes `slug`; and the cache
comment in `getRecipeBySlug` reasons explicitly about what must happen when a slug is renamed.
That is why decision 9 has to be made now even though edit is a non-goal — hiding the slug field
decides how edit behaves the day it lands.

**There is no drift detection.** Docker is unavailable, so `db pull`, `db diff` and `db dump`
all fail. `db:push` and `db:types` work. Phase 1 drops a column from a live table, and nothing
in the toolchain will warn if that column holds data. Hence the gate below.

**`save_recipe` is a hand-synced contract.** `lib/recipes/schema.ts` and the SQL function have
to agree; a field removed from one must be removed from the other. Phase 1 changes both in the
same commit for that reason.

**Both recipe-rendering routes are reportedly broken.** `c65bf67` ("disable the view/preview
action until its pages work") landed while this plan was being written and states that neither
`/recipes/[slug]` nor `/admin/preview/[slug]` renders yet — the manage table's view button is
disabled behind a tooltip saying so, with the href kept in a comment for a one-line restore. The
page sources look structurally complete, so the cause is a runtime finding from that session and
is not diagnosed here. It touches this plan twice: phase 3 changes both of those pages' call
sites, and phase 4's save redirects to the preview route. See the open question below.

**The current form already gets the hard part right.** `RecipeForm` holds ingredients and steps
as arrays in client state and serialises them into one hidden `payload` field. The wizard keeps
that wholesale — this is a re-layout, not a rewrite of the data path.

## Approach

Four phases in dependency order, each its own commit. The order is not cosmetic: groups go
first so the wizard is never written against a column that is about to vanish, and the
`RecipeArticle` prop change lands before the wizard because the preview depends on it.

### Phase 1 — Remove ingredient groups

**Gate, before `db:push`:** run

```sql
select count(*) from recipe_ingredients where group_label is not null;
```

in the Supabase SQL editor. Non-zero means real data is about to be destroyed and cannot be
recovered — there is no shadow database and no diff to catch it. Stop and decide before
proceeding.

One migration containing both halves, in this order so the function never references a dropped
column:

1. `create or replace function public.save_recipe(payload jsonb)` — identical to
   `supabase/migrations/20260801145324_save_recipe_function.sql` minus the `group_label` column
   and its `nullif(trim(item ->> 'group_label'), '')` value. Keep `security invoker`,
   `set search_path = ''` and the grants exactly as they are.
2. `alter table public.recipe_ingredients drop column group_label;`

Then `npm run db:types` and `npm run typecheck`. The dropped column should break every reader —
that is the payoff, not a problem to work around.

The readers to fix: `ingredientSchema` in `lib/recipes/schema.ts` loses `group_label`, and
`hasContiguousGroups()` plus its `.refine` go with it; `groupIngredients()` in `RecipeArticle`
is deleted and the ingredient list flattens; `RecipeForm` loses the Group input and the field on
`IngredientRow` / `EMPTY_INGREDIENT`. That form is deleted in phase 4, but phase 1 has to leave
the tree compiling on its own.

Docs: the `recipe_ingredients` line in `CLAUDE.md`, and a **superseding note** appended to
decision 7 of `docs/plans/recipe-schema-redesign/decisions.md`. Do not rewrite that entry — it
records what was true when it was decided.

### Phase 2 — DifficultyBadge, tokens, fraction formatting

Six tokens in `app/globals.css`, in both `:root` and `.dark`: `--difficulty-easy` and
`--difficulty-easy-bg`, and the same for `medium` and `hard`. Values are in the mockup's `:root`
block. Decision 4 explains why these are not aliases of `--secondary` / `--primary` /
`--destructive`.

`components/shared/DifficultyBadge.tsx` takes `{ difficulty: RecipeDifficulty | null }`, returns
`null` for null, and wraps the `ui` `Badge` with a difficulty→className map. No colour dot —
that was tried in the mockup and rejected.

Two call sites, and only two: the flat `<Badge variant="secondary">` in `RecipeArticle`, which
currently renders all three difficulties the same green, and the plain capitalised text in
`RecipeRow`'s Difficulty field. `NOT_SET` behaviour is unchanged. Decision 4 records why
`RecipeCard` and the wizard's Review checklist were both considered and left out.

`formatAmount()` in `RecipeArticle` gains fraction glyphs — `0.5 → ½`, `0.25 → ¼`, `0.75 → ¾`,
`0.33 → ⅓`, `0.67 → ⅔`, with any whole part prefixed so `1.5 → 1½`. Anything without a clean
glyph prints as the number. The column stays `numeric`; this is presentation only.

### Phase 3 — Narrow `RecipeArticle`'s prop type

`RecipeArticle` takes `RecipeWithChildren` today and keys its lists off `ingredient.id` while
rendering `step.step_number`. A draft has neither. Introduce a view type — `RecipeView` in
`types/recipes.ts` — covering only what the article renders: `title`, `description`,
`difficulty`, `prep_minutes`, `cook_minutes`, `servings`, `notes`, plus
`ingredients: { name, amount, unit }[]` and `steps: { instruction, note }[]`.

Real rows satisfy it structurally, so both call sites — `app/recipes/[slug]/` and
`app/admin/preview/[slug]/` — pass a mapped object through one small helper rather than
repeating the spread. Keys become the array index and step numbers become `index + 1`, which is
correct because `getRecipeBySlug` and `getDraftBySlug` already order the children by
`sort_order` and `step_number`.

Decision 8 records the constraint this creates and why it must not be forgotten.

### Phase 4 — The wizard

Lives in `app/admin/_components/`, **not** under the route, for the reason
`app/admin/create/page.tsx` already documents: edit will reuse it from a sibling route.
`RecipeForm.tsx` is deleted, not left alongside.

`recipeSchema` splits into `detailsSchema`, `ingredientsSchema` and `stepsSchema`, composed back
into the whole. zod is `^4.3.6`, where `.merge()` is deprecated — compose with
`z.object({ ...detailsSchema.shape, ...ingredientsSchema.shape, ... })`. Each step's ✓ is that
step's `safeParse(...).success` and nothing else; decision 2 explains why a hand-written
completeness helper is not acceptable here, and what has to be true for the parse-driven tick to
be usable.

Field layout, after the rebalance in decision 6:

| Step             | Fields                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Details          | Title, Short description, Difficulty / Prep / Cook                            |
| Ingredients      | Servings, then Amount / Unit / Ingredient rows with up · down · remove        |
| Steps            | Numbered instruction textarea + optional note, with the same row controls     |
| Review & Publish | Completeness checklist, publish switch, Save, and the full article underneath |

Steps 1–3 are freely clickable; Review is locked until all three parse. The preview rail sits on
the right of steps 1–3 only, sticky, rendering the real `RecipeArticle` via phase 3's view type
and dimming the two sections that do not match the current step. It is not rendered at all below
1024px.

**Steps 1–3 contain no `<form>` element.** Only the Review panel wraps
`<form action={formAction}>` around the hidden `payload` field and the Save button. This is
structural, not stylistic — decision 12. The `Suspense` boundary that `create/page.tsx` already
needs moves with the form.

The slug is derived from the title by `slugify()`, never editable, and displayed read-only under
the title. Three states on that line, per decisions 9, 10 and 11: the normal derived address; a
title that produces no address at all; and a collision, which asks for a different title and
offers no way to edit the URL.

Add the refresh-loses-everything note to `docs/known-issues.md`, and prune `README.md`'s Planned
Features — it still lists "Ingredient lists", "Cooking instructions", "Admin dashboard for
managing recipes" and "Editing and deleting recipes", most of which have shipped. What remains
genuinely pending is tags, images (point at `docs/image-storage.md`), search filters and editing.

## Components

- **`supabase/migrations/<new>.sql`** — replaces `save_recipe` without `group_label`, then drops
  the column. Both halves in one file.
- **`types/database.ts`** — regenerated. Never hand-edited.
- **`lib/recipes/schema.ts`** — `group_label` and `hasContiguousGroups` removed; split into
  `detailsSchema` / `ingredientsSchema` / `stepsSchema` composed into `recipeSchema`.
- **`types/recipes.ts`** — adds `RecipeView` and the row→view mapper.
- **`app/globals.css`** — six difficulty tokens in `:root` and `.dark`.
- **`components/shared/DifficultyBadge.tsx`** — new. The only place difficulty colour is decided.
- **`components/shared/RecipeArticle.tsx`** — takes `RecipeView`; `groupIngredients` deleted;
  `formatAmount` gains fraction glyphs; renders `DifficultyBadge`.
- **`app/recipes/[slug]/page.tsx`, `app/admin/preview/[slug]/page.tsx`** — pass the mapped view.
- **`app/admin/manage/_components/RecipeRow.tsx`** — Difficulty field renders the badge.
- **`app/admin/_components/` — the wizard** — new. One state owner holding the draft, the
  stepper, the four step panels and the preview rail. Whether the panels are separate files is an
  open question below; the state owner is not.
- **`app/admin/_components/RecipeForm.tsx`** — deleted in phase 4.
- **`app/admin/create/page.tsx`** — renders the wizard; keeps its `Suspense` boundary.
- **`CLAUDE.md`, `README.md`, `docs/known-issues.md`,
  `docs/plans/recipe-schema-redesign/decisions.md`** — documentation, per the phases above.

## Risks

- **Dropping `group_label` is irreversible and unguarded.** No `db:diff`, no shadow database,
  no backup step in the toolchain. Mitigated only by the `select count(*)` gate, which is a
  human step that can be skipped. Treat it as the one blocking check in phase 1.
- **`RecipeArticle` enters the client bundle** the moment the wizard imports it, which forbids it
  ever importing `next/headers` or a Supabase server client. Nothing today violates this and
  nothing warns if something later does — the failure surfaces as a build error far from the
  cause. Recorded as decision 8 so it is findable.
- **Renaming a title silently kills a live URL.** `updateTag("recipes")` clears the cached entry
  on the same response, so the old address 404s immediately. Mitigated on edit by a warning, not
  by a redirect. Accepted in decision 9.
- **One refresh empties the wizard.** Four steps of typing, no recovery. Accepted in decision 14
  and logged.
- **The ✓/zod coupling can rot.** It holds only while every input that can produce an invalid
  value is sanitised. Add a field with a new rule and forget the sanitiser, and the tick goes
  green over a value the server will reject — the exact bug the first mockup shipped with.
  Decision 2 names the invariant; there is no test to enforce it.

## Open questions

- **Whether `/recipes/[slug]` and `/admin/preview/[slug]` work by the time this is built, and
  what fixing them costs.** Per `c65bf67` they do not render today. This plan assumes they will:
  phase 3 rewrites how both receive their data, and `saveRecipe` already redirects to
  `/admin/preview/${slug}` on success, so a wizard that saves correctly still lands on a broken
  page. Diagnose that before phase 3 — if the fault turns out to be in `RecipeArticle` rather
  than in the routes, phase 3 is the natural place to fix it, and the live preview would have
  inherited the same fault.
- **What the mapper is called and where it lives** — `types/recipes.ts` beside `RecipeView`, or
  a function in `lib/recipes/`. Implementation's call; it has one job and two callers.
- **How the preview emphasises the current step.** The mockup dims the other two sections and
  scrolls. If dimming reads as broken rather than focused, drop to scroll-only — it was flagged
  as adjustable when the mockup was reviewed.
- **Whether the wizard's step panels are separate files or one.** Four panels plus a stepper plus
  a preview in one file will be long; splitting them means threading state down. Neither was
  decided.

## Assets

- [create-wizard-mockup.html](assets/create-wizard-mockup.html) — the interactive mockup, and
  the closest thing to a spec for the layout. The stepper, row controls and preview all work;
  the toolbar toggles empty state and the slug collision. Its legend lists what is deliberately
  absent, what is mockup-only scaffolding, and the structural choices that are not visible.
