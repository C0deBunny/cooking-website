# Plan: Admin manage-recipes page

## Goal

Replace the `/admin/manage` placeholder card with a real management screen: a header band, a
table of every recipe including drafts, an expandable row showing the rest of a recipe's
metadata, and per-row actions for edit, publish, view and delete.

This is the slice that decision 19 of `docs/plans/recipe-schema-redesign/decisions.md`
explicitly deferred — "create only, `/admin/manage` stays a placeholder". Its dependencies come
due here, which is why two of the four row actions ship pointing at routes that do not exist yet.

## Non-goals

- **The edit form and its route.** The button ships disabled. Where it points is an open
  question below; decision 12 of the schema redesign means edit is a UI-only addition with no
  schema or function change, so this stays cheap.
- ~~**A public `/recipes/[slug]` to link to.**~~ **No longer a non-goal** — `8bb5c4f` landed
  both `/recipes/[slug]` and `/admin/preview/[slug]` while this plan was being written, so
  _view on site_ became a real link instead of a disabled button. See decision 14.
- **Tags.** That vertical is owned by its own session — see decision 15 of the schema redesign.
  A Tags column is purely additive later.
- **Images and Storage.** No bucket exists; see `docs/image-storage.md`.
- **Bulk actions.** No select-all, no multi-delete. A dozen personal recipes do not need them.
- **Any schema, RLS or permission-model change.** Two roles, no ownership column — see
  `docs/permission-model.md`.

## Context

**What exists.** _Corrected after `8bb5c4f`, which landed between this plan being agreed and
being implemented._ `app/admin/manage/page.tsx` is the only remaining placeholder;
`/admin/create` has a real `RecipeForm`, and `/recipes/[slug]` and `/admin/preview/[slug]` both
exist. `lib/recipes/` has all three files — `queries.ts`, `actions.ts` (with `saveRecipe`) and
`schema.ts` — so this work **extends** the recipe write path rather than introducing it.
`app/admin/layout.tsx` provides the gate and the sidebar shell, so a new page under `/admin`
inherits both.

`Toaster` and `TooltipProvider` are mounted **only** in `app/dev/layout.tsx`, which
`app/dev/_components/OverlaysSection.tsx` warns about explicitly. Neither degrades gracefully:
a `Tooltip` without a provider throws, and `toast()` without a `Toaster` silently does nothing.
This work mounts both in the admin layout.

**The schema is ready.** Contrary to an assumption made early in the brainstorm and corrected
before this plan was written: the schema-redesign migrations _are_ applied and
`types/database.ts` _is_ current. `prep_minutes`, `cook_minutes`, `notes`, `servings` and the
`save_recipe` function are all present. Nothing needs pushing or regenerating before this work
starts.

**Sequencing.** Resolved by events rather than by decision: `/admin/create` shipped first, so
this page is built against recipes the form can actually produce and the empty state is
exercised once rather than lived in.

**Available primitives.** `components/ui/` already has `table`, `collapsible`, `alert-dialog`,
`badge`, `tooltip`, `skeleton`, `switch`, `sonner` and `pagination`. It does **not** have
`dropdown-menu`. Nothing new needs generating.

**Conventions to follow.** `CLAUDE.md` covers these and they are not restated here: the
three-file domain module shape, the Supabase client-selection table, the `"use cache"` /
`cacheTag` rules and `updateTag` vs `revalidateTag`, the page shell pattern, the
import-comment grouping, the semantic theme tokens, and prettier's settings. Route-specific
components colocate under the route in `_components/`; domain logic does not.

## Approach

The page is a server component. It renders the header band immediately and puts the data
behind `<Suspense>`, because with `cacheComponents: true` a cookie read that blocks the page
shell fails `npm run build` with `StaticGenBailoutError` — the same constraint that forces
`AdminGate` into a boundary. A server child inside that boundary performs the read and hands
the result to a single client component.

The read is deliberately **not** `getRecipes()`. That one is `anon` plus `"use cache"`, and RLS
limits `anon` to published rows, so reusing it would produce a management page that silently
never shows a draft. `getRecipesForAdmin()` uses the cookie-backed server client with no
caching, which is the only way the request is `authenticated` and therefore able to see
drafts. This is the same fork decision 13 of the schema redesign made for the draft preview
route.

Everything interactive lives in one client `RecipeTable`: the search box, the status filter,
the sort, the accordion state, and the row markup. Filtering and sorting run in TypeScript over
the rows already in memory, so every control is instant. An earlier shape — keeping the table
on the server and driving the controls through `searchParams` — was worked through and
rejected; the reasoning is decision 6 in `decisions.md`, and decision 4 there records why the
client boundary moved. Plain decision numbers below refer to that file; references to the
schema redesign's decisions are always named as such.

Writes are two small server actions, both gated by `requireUser()` before touching the
database, because a server action compiles to a public HTTP endpoint and should refuse before
RLS ever sees the request. Each invalidates two things for two different reasons: the cached
public list, and this page's client router cache.

The choices that produced this shape, including the ones reversed mid-discussion, are in
`decisions.md`. The rendered screen is in `assets/admin-manage-mockup.html`.

## Components

- **`app/admin/manage/page.tsx`** — server. Replaces the placeholder. Header band following the
  project's page shell pattern: title, a `N recipes · N published · N drafts` line, and a
  primary _New recipe_ button linking to `/admin/create`. Below it, `<Suspense>` wrapping the
  data. Holds no state and reads no request data itself.

- **`app/admin/manage/_components/RecipeTableSection.tsx`** — server. The suspended child. Its
  only job is `await getRecipesForAdmin()` and rendering `<RecipeTable recipes={...} />`. It
  exists so the cookie read sits below a boundary rather than in the page.

- **`app/admin/manage/_components/RecipeTable.tsx`** — `"use client"`. The only client
  boundary. Owns `query`, `status`, `sort`, `dir` and `openId: number | null`, derives the
  visible rows with `filter`/`sort`, and renders the controls strip, the `<table>`, and the
  four list states. Columns: chevron · Title · Status · Updated · actions.

- **`app/admin/manage/_components/RecipeRow.tsx`** — a plain child inside the client tree, not
  its own boundary. Renders the row plus, when open, a sibling `<tr>` with `colSpan` holding
  the detail panel. Two things must be right: the action buttons need `stopPropagation()` or
  every click also toggles the row, and the expand trigger must be a real `<button>` in the
  chevron cell carrying `aria-expanded` and `aria-controls`, since a clickable `<tr>` cannot be
  reached by keyboard.

- **`app/admin/manage/_components/TableSkeleton.tsx`** — server. The `Suspense` fallback, built
  from `components/ui/skeleton.tsx`. Should approximate the real row height so the page does
  not jump when data arrives.

- **`app/admin/error.tsx`** — `"use client"`, as error boundaries must be. Receives
  `{ error, reset }`, shows a plain sentence plus `error.digest` in small monospace, and a
  _Try again_ button calling `reset()`. Because it sits at `app/admin/`, it renders inside the
  admin layout, so the sidebar, navbar and footer survive a failure and only the content region
  is replaced.

- **`lib/recipes/queries.ts`** — gains `getRecipesForAdmin()`. Server client, **no**
  `"use cache"`, **no** `cacheTag`, and this file stays out of `"use server"`. Selects `*`
  ordered by `created_at desc`; no filtering in the query, since the client does it.

- **`lib/recipes/actions.ts`** — extended alongside the existing `saveRecipe` with
  `togglePublished` and `deleteRecipe`. Both call `requireUser()` first, both `updateTag`
  and `revalidatePath` as above, and both return `{ error?: string }` rather than throwing,
  since an error boundary cannot catch a server action. Failures surface through `sonner`.
  Both also `.select("id")` and check the returned row count: a write RLS refuses comes back
  with no error and zero rows, so a silent no-op would otherwise be reported as success.

- **`lib/recipes/schema.ts`** — extended with `recipeIdSchema`, `publishToggleSchema` and
  `RecipeMutationState`. The state type is separate from `RecipeFormState` on purpose: these
  mutations are not forms and are not driven by `useActionState`.

- **`app/admin/layout.tsx`** — mounts `Toaster` and `TooltipProvider`, which the manage page's
  action feedback and icon labels both depend on. See Context.

- **`lib/utils.ts`** — gains `formatTimestamp()`. Day granularity and a pinned locale, both
  because the table is server-rendered then hydrated and anything finer risks the two renders
  disagreeing.

## Risks

- **Reusing `getRecipes()` is the failure that looks like success.** RLS hides drafts from
  `anon`, so the wrong client produces a page that renders perfectly and is missing exactly the
  rows the page exists for. Nothing errors. Mitigation: the separate named query, and checking
  against a known draft during the manual pass.

- **The `Suspense` boundary is load-bearing.** Move the read up into the page body and
  `npm run build` fails with `StaticGenBailoutError`. It is not decoration, and the same
  applies to any request-data read added later.

- **Post-action refresh is unverified.** `revalidatePath` on an uncached route should refresh
  the client router cache, but Next 16 reworked this API surface — `revalidateTag` now requires
  a second argument. If the badge does not flip after a publish, `router.refresh()` inside the
  transition is the fallback. Verify in `npm run dev`; do not assume.

- **Click bubbling.** Action buttons live inside a clickable row. Without `stopPropagation()`
  every publish also toggles the expand, which is the kind of bug that reads as "the animation
  is glitchy" rather than as an event-handling mistake.

- **A clickable `<tr>` is not a control.** It is not focusable, not announced, and unreachable
  by keyboard. `tabIndex={0}` on the row is not the fix; a real button in the chevron cell is.

- **`AdminGate` failures escape the boundary.** `app/admin/error.tsx` catches its sibling
  segments and below, not the layout at its own level. If the gate throws, the user still gets
  Next's bare fallback. Accepted; closing it needs a root `app/error.tsx`.

- **Client-side filtering assumes a small list.** Correct at a dozen recipes, wrong at a few
  hundred — at which point filtering moves into the query and the control state probably moves
  to the URL after all. Decision 6 records why that is a cheap change rather than a rewrite.

- **`deleteRecipe` will acquire an obligation it does not have yet.** `on delete cascade`
  removes steps, ingredients and image _rows_, but once a Storage bucket exists the files
  behind those rows will orphan. Revisit when `docs/image-storage.md` is resolved.

- **Status is now the only visual differentiator between rows.** With difficulty and time moved
  into the panel (decision 11), a screen of similar titles leans entirely on one badge. This
  makes the status filter load-bearing rather than a convenience.

## Open questions

- **Where the edit route lives** — `/admin/edit/[slug]` or `/admin/recipes/[id]/edit`. Whatever
  is chosen, decision 20 of the schema redesign warns that the slug's title-autosync must stop
  for saved recipes, or fixing a typo silently changes a live URL. Now the only thing standing
  between this page and a complete action row: `RecipeForm` takes no props and is create-only,
  so edit means threading an optional recipe through it as well as adding the route.
- **Whether the slug needs a home.** Decision 12 removed it from this page entirely, so no
  screen currently shows which URL a recipe maps to. Reconsider when the edit form lands, since
  that form will have to show it anyway.
- ~~**Relative vs absolute dates.**~~ Settled during implementation: `formatTimestamp()` is
  relative for the past week and an absolute short date after that.

## Assets

- [admin-manage-mockup.html](assets/admin-manage-mockup.html) — the interactive mockup that
  settled the layout. Live rows with the accordion, action tooltips and the delete dialog; the
  inline-vs-sheet comparison that decided decision 3; the empty state; and a notes panel
  listing the traps above against the part of the screen each one applies to.
