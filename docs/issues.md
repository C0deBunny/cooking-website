# Known issues — architecture & layout

Findings from an architecture review of the initial setup (2026-07-28). The repo was scaffolded
by a trainee; the instincts are mostly sound but a few layout decisions are causing real defects
and others will as the app grows.

Nothing here has been fixed yet. Items are ordered worst-first. The suggested work order is at
the bottom — it differs from the severity order because some cheap fixes unblock later ones.

Status legend: `[ ]` open, `[x]` fixed. Update this file as items land.

---

## 1. `Actions/` mixed reads with mutations, and the reads paid for it

- [x] **Fixed** — `Actions/` is gone. Reads live in [lib/auth/queries.ts](../lib/auth/queries.ts)
      wrapped in React's `cache()`; mutations in [lib/auth/actions.ts](../lib/auth/actions.ts); the
      zod schema and `LoginState` in [lib/auth/schema.ts](../lib/auth/schema.ts). One
      `auth.getUser()` per render instead of three.

`Actions/auth/Auth.ts` exported `getCurrentUser` and `requireUser` from a `"use server"` file. Both
are _reads_. Consequences:

- `"use server"` turned each into a callable POST endpoint for no benefit.
- More importantly it blocked wrapping them in React's `cache()`, so calls were not deduped.
  [navbar/Navigators.tsx](../components/feature/layout/navbar/Navigators.tsx),
  [NavbarAuthSlot.tsx](../components/feature/layout/navbar/NavbarAuthSlot.tsx) and
  [footer/Navigators.tsx](../components/feature/layout/footer/Navigators.tsx) each call it, so
  **every page render made 3 separate `auth.getUser()` round-trips to Supabase.**

Two details worth keeping in mind for future work:

- `cache()` dedupes per request, so the three callers sitting in separate `Suspense` boundaries
  still share one Supabase call.
- Only async functions may be exported from a `"use server"` file. That is why `loginSchema` and the
  `LoginState` type moved to `schema.ts` rather than staying beside the action.

`requireUser` is still unused — issue 6 (the admin route gate) is what will consume it.

## 2. Nothing calls `revalidateTag("recipes")` — the public page serves stale recipes

- [ ] **Open**

[lib/data/recipes.ts](../lib/data/recipes.ts) is `"use cache"` + `cacheTag("recipes")`, and the
only write path is a raw `supabase.insert()` inside a client component
([app/admin/page.tsx](../app/admin/page.tsx)). The tag is therefore never invalidated, so
**a new recipe takes up to 15 minutes to appear on `/recipes`** — the default `"use cache"`
revalidate window, visible as `Revalidate 15m` in `npm run build` output. The owner adds a recipe,
sees it on `/admin` (client-fetched, always fresh), and does not see it on the public page.

This is a layout consequence, not an oversight: the mutation lives somewhere that structurally
cannot revalidate. Moving it into a server action fixes the bug as a side effect.

## 3. Recipe queries live in three places

- [ ] **Open**

[lib/data/recipes.ts](../lib/data/recipes.ts),
[app/admin/page.tsx](../app/admin/page.tsx) and the orphaned
`components/shared/AddRecipeButton.tsx` each queried `recipes` directly. A data layer that gets
bypassed isn't a data layer. Two of the three already disagreed — `lib/data` has no `.order()`,
admin orders by `created_at desc`.

`AddRecipeButton` was dead code (nothing imported it) and also passed `data` to its callback without
null-checking after an error. **Deleted.** Two query sites remain.

**Fix:** `lib/data/recipes.ts` becomes the only place recipes are read; a server action is the only
place they are written. Lands with issue 2.

## 4. `components/feature/` vs `components/shared/` has already collapsed

- [ ] **Open**

The split forces a judgment call with no correct answer on every new component, and it has already
gone wrong:

- `RecipeCard` sits in `shared/` but is only used by the two recipe pages.
- The theme provider — which wraps the entire app — lives at
  `components/feature/layout/navbar/theme/NextThemesProvider.tsx`.

**Fix:** colocate route-specific components under their route in a `_components/` folder (the
leading underscore marks a private, non-routable folder in the App Router). `components/` then holds
only genuinely cross-route things: `ui/`, `layout/`, and the handful of shared pieces.

## 5. Duplicated navigation and site name

- [ ] **Open**

Two different files are both named `Navigators.tsx`
([navbar](../components/feature/layout/navbar/Navigators.tsx),
[footer](../components/feature/layout/footer/Navigators.tsx)) and both hardcode the nav links.
Adding a route means editing two files and hoping they match.

The site name `Chique's Swiet Mofo` is hardcoded in four places: layout metadata, both
`Navigators`, and [heroSection.tsx](../components/feature/hero/heroSection.tsx).

**Fix:** `config/site.ts` exporting the name and a `navLinks` array; one presentational nav
component consumed by both header and footer.

## 6. `/admin` has no server-side auth check

- [ ] **Open**

There is no `app/admin/layout.tsx`, and the page is `"use client"`. RLS stops the write and recipes
are public anyway, so this is **not a data leak** — but anyone who types the URL loads the admin UI.

**Fix:** `(public)` / `(admin)` route groups, with an `(admin)/layout.tsx` calling `requireUser()`.
One gate, applied to everything underneath it, permanently.

## 7. `lib/utils/utils.ts` breaks the shadcn setup

- [x] **Fixed** — `lib/utils.ts`, seven `components/ui/*` imports reverted to `@/lib/utils`,
      matching `components.json`. `npx shadcn add` now resolves correctly.

[components.json](../components.json) declares `"utils": "@/lib/utils"`, but the file lived at
`lib/utils/utils.ts`. To make that work, all seven `components/ui/*` files were hand-edited to
import `@/lib/utils/utils` — which contradicted the "generated, don't hand-edit" rule. The next
`npx shadcn add` would have emitted `@/lib/utils`, which would not have resolved.

## 8. Database types are hand-written

- [ ] **Open**

[types/recipes.ts](../types/recipes.ts) is maintained by hand while the `supabase` CLI is already a
devDependency. A migration that renames a column currently fails in production instead of at
typecheck.

**Fix:** generate `types/database.ts` and derive
`type Recipe = Database["public"]["Tables"]["recipes"]["Row"]`. Drop the `Recipes = Recipe[]`
alias — `Recipe[]` reads better at call sites.

## 9. Smaller items

- [ ] `lib/supabase/browser-client.ts` and `server-client.ts` both export a function named
      `createClient`, making call sites ambiguous. Supabase's own convention is `client.ts` /
      `server.ts` / `anon.ts`, so the import path tells you which environment you're in.
- [ ] The cookie adapter is duplicated between [proxy.ts](../proxy.ts) and
      [lib/supabase/server-client.ts](../lib/supabase/server-client.ts). Extract it.
- [ ] [app/login/page.tsx](../app/login/page.tsx) renders a `<main>` inside the root layout's
      `<main>` — invalid HTML.
- [ ] No `app/error.tsx`, `app/not-found.tsx`, or `app/loading.tsx`.
- [ ] No recipe detail route (`/recipes/[id]`). Recipes also have no slug column.
- [x] **Fixed** — the unused Next scaffolding SVGs (`file.svg`, `globe.svg`, `next.svg`,
      `vercel.svg`, `window.svg`) are gone from `public/`.

---

## Conventions worth revisiting

These are documented in `CLAUDE.md` as intentional. They are being challenged, not violated —
decide deliberately, then update both files.

**Grouped import comments** (`// import lib`, `// import components`, …) are already drifting:
`//import lib`, `// import Components`, `// import hooks`, `// import fonts` all appear in the tree.
This is manual work, inconsistently applied, enforcing something `eslint-plugin-import`'s `order`
rule does automatically and correctly. Recommendation: add the lint rule, delete the comments.

**"Don't churn existing filenames."** There are currently four casing styles —
`heroSection.tsx`, `loginForm.tsx`, `Theme-toggle.tsx`, `RecipeCard.tsx`. The repo is ~25 files with
no collaborators and no history worth protecting, so this is the cheapest it will ever be to
normalize. Recommendation: normalize to PascalCase now, as part of item 4.

---

## Target layout

```
app/
  layout.tsx  error.tsx  not-found.tsx
  (public)/   page.tsx
              recipes/page.tsx
              recipes/[id]/page.tsx           ← does not exist yet
  (admin)/    layout.tsx                      ← requireUser() gate, one place
              admin/page.tsx                  ← server component, uses getRecipes()
                    _components/NewRecipeDialog.tsx   ← client, useActionState
                    _actions/createRecipe.ts          ← zod + insert + revalidateTag
  login/      page.tsx  _components/LoginForm.tsx
components/
  ui/                                         ← generated, untouched
  layout/     Navbar.tsx  Footer.tsx  ThemeProvider.tsx
  RecipeCard.tsx
lib/
  auth/queries.ts                             ← cache()'d reads, NOT "use server"
  auth/actions.ts                             ← login, signOut
  data/recipes.ts                             ← the only place recipes are read
  supabase/client.ts  server.ts  anon.ts  cookies.ts
  utils.ts
config/site.ts                                ← name + nav links
types/database.ts                             ← generated
```

---

## Suggested work order

Items 1–4 fix actual defects; the rest is structure.

1. ~~`lib/utils.ts` move + revert the 7 `components/ui` imports — issue 7 (unblocks shadcn)~~ **done**
2. ~~Delete `AddRecipeButton.tsx` and the unused default SVGs — issues 3, 9~~ **done**
3. ~~Auth reads → `lib/auth/queries.ts` with `cache()` — issue 1 (kills 2 of 3 round-trips)~~ **done**
4. Admin write → server action + `revalidateTag` — issues 2, 3
5. `config/site.ts`, then collapse the two `Navigators` into one component — issue 5
6. `(public)` / `(admin)` route groups + admin auth gate — issue 6
7. Flatten `feature/` + `shared/` into colocated `_components/`, normalizing casing — issue 4
8. Generated database types — issue 8
9. Lint import order, delete the import comment blocks — conventions
