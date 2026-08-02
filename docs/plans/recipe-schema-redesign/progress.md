# Progress: Recipe schema redesign

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-01

- **Did:** implemented the whole create-only slice. _(Was logged as "uncommitted"; it landed in
  `b6ba587` later the same day. Corrected 2026-08-02 during the docs audit. Note `group_label`,
  added below, was removed again in `c2c231d` — see the banner on this folder's plan.md.)_
  - `20260801145317_recipe_content_fields.sql` — dropped `time_minutes`, added `prep_minutes`,
    `cook_minutes`, `notes` to `recipes`, `group_label` to `recipe_ingredients`, `note` to
    `recipe_steps`, and `unique (recipe_id, sort_order)` to `recipe_images`. Added
    `is null or length(trim(…)) > 0` checks to the three new text columns so blank strings are
    refused at the database as well as normalised in zod.
  - `20260801145324_save_recipe_function.sql` — `save_recipe(payload jsonb)`, `security invoker`,
    `search_path = ''`, execute revoked from `public`/`anon` and granted to `authenticated`.
    Every cast wrapped in `nullif(…, '')` so an empty form field can't raise on `::int`.
  - `lib/recipes/schema.ts`, `lib/recipes/actions.ts` (new), `getRecipeBySlug` +
    `getDraftBySlug` in `queries.ts`, `slugify()` in `lib/utils.ts`,
    `components/shared/RecipeArticle.tsx`, `app/recipes/[slug]/`,
    `app/admin/preview/[slug]/`, `app/admin/_components/RecipeForm.tsx`, and the real
    `app/admin/create/page.tsx`.
  - `app/admin/layout.tsx` — wrapped `AdminSidebar` in `Suspense`. Not cosmetic: see below.
- **Verified:**
  - `db push` applied both migrations (dry-run first); `db:types` regenerated and emitted
    `save_recipe: { Args: { payload: Json }; Returns: number }` as expected.
  - `tsc --noEmit`, `eslint`, `prettier --check .` and `next build` all clean. The build lists
    every route as prerendered.
  - `slugify()` checked against the real `recipes.slug` regex over six inputs including accents
    and punctuation — all pass.
  - `parsed.data` satisfies the generated `Json` argument type with no cast.
- **Found while building:** `cacheComponents: true` rejects `export const dynamic` outright, so
  there is no route-level opt-out — `Suspense` is the only mechanism. Three separate things count
  as request data and each failed the build until wrapped: `await params` in a page body, the
  server action bound to `<form action={…}>`, and `usePathname()` in `AdminSidebar` (which only
  became a problem when `/admin` gained its first dynamic child). Pages now pass the `params`
  promise down to a Suspended child instead of awaiting it themselves.
- **Not verified — needs you:** the authenticated happy path. Nothing here has exercised
  `save_recipe` as a logged-in user, because the Supabase SQL editor runs as a privileged role
  and so does not test `security invoker` or RLS, and env access was unavailable in-session. Run
  `npm run dev`, sign in, and submit the form at `/admin/create`; a success redirects to
  `/admin/preview/<slug>`.
- **Next:** edit mode (`/admin/manage` list + the form loading an existing recipe — the function
  already takes `payload.id`), then the Storage bucket, then tags from the other session.
