# Known issues — architecture & layout

Findings from an architecture review of the initial setup (2026-07-28). The repo was scaffolded
by a trainee; the instincts are mostly sound but a few layout decisions are causing real defects
and others will as the app grows.

Items are ordered worst-first. The suggested work order is at the bottom — it differs from the
severity order because some cheap fixes unblock later ones. Issues 1, 2, 3 and 7 are done; the
fixed entries are kept rather than deleted, because the reasoning is the useful part.

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

## 2. No mutation invalidated the `recipes` cache tag — the public page served stale recipes

- [x] **Fixed** — the write is a server action ([lib/recipes/actions.ts](../lib/recipes/actions.ts))
      that calls `updateTag("recipes")`, so both `/recipes` and `/admin` show a new recipe
      immediately.

`lib/data/recipes.ts` was `"use cache"` + `cacheTag("recipes")`, and the only write path was a raw
`supabase.insert()` inside a client component. The tag was therefore never invalidated, so a new
recipe took up to 15 minutes to appear on `/recipes` — the default `"use cache"` revalidate window,
visible as `Revalidate 15m` in `npm run build` output.

**Use `updateTag`, not `revalidateTag`.** Next 16 split these:

| Function                      | Semantics                                                               | Use for                  |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `updateTag(tag)`              | server-action only, read-your-own-writes — fresh on the same response   | form submissions         |
| `revalidateTag(tag, profile)` | marks entries stale for a later background refresh; profile is required | webhooks, external syncs |

An earlier draft of this file told you to call `revalidateTag` here. That would compile only with a
second argument and still would not guarantee the owner sees their own recipe on submit.

This was a layout consequence, not an oversight: the mutation lived somewhere that structurally
could not invalidate a server cache. Moving it into a server action fixed the bug as a side effect —
which is the general lesson worth keeping from this one.

## 3. Recipe queries lived in three places

- [x] **Fixed** — [lib/recipes/queries.ts](../lib/recipes/queries.ts) is the only place recipes are
      read; [lib/recipes/actions.ts](../lib/recipes/actions.ts) the only place they are written.
      `lib/data/` is retired.

`lib/data/recipes.ts`, `app/admin/page.tsx` and the orphaned `components/shared/AddRecipeButton.tsx`
each queried `recipes` directly. A data layer that gets bypassed isn't a data layer. Two of the three
disagreed on ordering — `lib/data` had no `.order()` while admin sorted `created_at desc`. The
ordering now lives in `getRecipes()`, so **both pages are newest-first**.

`AddRecipeButton` was dead code and also passed `data` to its callback without null-checking after an
error. Deleted in an earlier step.

### The layout decision this settled

Each domain gets one folder — `queries.ts` (reads), `actions.ts` (`"use server"` writes),
`schema.ts` (zod + action state) — mirroring `lib/auth/`. Route-specific **components** still
colocate under the route in `_components/`; domain logic does not, because recipes are read from
`/`, `/recipes` and `/admin`, and editing will eventually be reachable from more than one route.

The alternative was colocating the write in `app/admin/_actions/`. Rejected: it splits one domain
across two trees and leaves three folders holding the same category of code.

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

- [ ] **Open** — partially mitigated

The write is now safe: `createRecipe` calls `requireUser()` before inserting, so an anonymous POST
is redirected regardless of RLS. What remains is the **page** — there is no `app/admin/layout.tsx`,
so anyone who types the URL still loads the admin UI (and sees the same public recipe list they can
already see at `/recipes`). Not a data leak; an unguarded surface.

**Fix:** `(public)` / `(admin)` route groups, with an `(admin)/layout.tsx` calling `requireUser()`.
One gate, applied to everything underneath it, permanently. This is what finally consumes
`requireUser` at the page level.

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
- [ ] `lib/supabase/browser-client.ts` is now unused — moving the admin write to a server action
      removed its last caller. Kept deliberately for things that genuinely need a browser client
      (realtime subscriptions, storage uploads). Delete it if those never materialise.
- [ ] No `app/error.tsx`, `app/not-found.tsx`, or `app/loading.tsx`.
- [ ] No recipe detail route (`/recipes/[id]`). Recipes also have no slug column.
- [x] **Fixed** — the unused Next scaffolding SVGs (`file.svg`, `globe.svg`, `next.svg`,
      `vercel.svg`, `window.svg`) are gone from `public/`.

## 10. Audit the Supabase integration end to end

- [ ] **Open — deliberately deferred.** Not scheduled. Owner wants the whole Supabase surface
      verified at some point: are we calling the right APIs, in the right places, with the right
      options? Nothing below is a confirmed defect — they are questions to answer, and each one
      should be checked against current Supabase docs rather than assumed.

Installed: `@supabase/ssr` 0.9.0, `@supabase/supabase-js` 2.99.1, `@supabase/auth-js` 2.99.1.

**Are we using the right auth read?** All three exist on the installed client:

| Method       | Cost                         | Trust                                    |
| ------------ | ---------------------------- | ---------------------------------------- |
| `getSession` | local, reads the cookie      | unvalidated — never gate on it           |
| `getUser`    | network call to the auth API | validated                                |
| `getClaims`  | local JWT verify             | validated, if asymmetric signing keys on |

We call `getUser()` in both [proxy.ts](../proxy.ts) and
[lib/auth/queries.ts](../lib/auth/queries.ts) — so **potentially two auth round-trips per request**,
one for the session refresh and one for the render. `cache()` cannot dedupe across those two,
because the proxy runs in a separate context. Worth checking whether `getClaims()` (added for
exactly this, and present in 2.99.1) can replace the render-time call, which would make it free.
Requires JWT signing keys enabled on the Supabase project — verify before relying on it.

**Is `public-client.ts` configured correctly for server use?** It calls plain
`createClient()` from `@supabase/supabase-js` with no `auth` options. A stateless server client
normally wants `auth: { persistSession: false, autoRefreshToken: false }` so it never tries to
store or refresh a session. Confirm whether the default already does the right thing in a Node
server context, or whether we are relying on it accidentally.

**Is the cookie adapter still the recommended shape?** [server-client.ts](../lib/supabase/server-client.ts)
has a bare `catch {}` around `cookieStore.set` — that is from the Supabase docs (writes fail in
server components, which is expected), but it is undocumented in our code and worth a comment.
Also confirm `getAll`/`setAll` is still the current API and that `proxy.ts` matches what
`@supabase/ssr` 0.9 expects from Next 16's renamed middleware, including the matcher.

**Do the RLS policies actually exist and say what we think?** This is the load-bearing one. Both
keys are `NEXT_PUBLIC_*`, so RLS is the _only_ thing protecting writes — and nothing in this repo
verifies it. Check on the `recipes` table: is RLS enabled; is `select` open to `anon`; is
`insert`/`update`/`delete` restricted to the authenticated owner. Needs the dashboard or
`supabase` CLI, not a code read.

**Also worth confirming:** whether `signInWithPassword` is the right flow for a single-owner site
or whether magic-link/OTP would be less to get wrong, and whether anything needs
`auth.onAuthStateChange` now that no client component holds a Supabase client (see the
`browser-client.ts` note above).

Overlaps issue 8 — `supabase gen types` is part of the same sweep.

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

Domain logic lives in `lib/<domain>/`; only components colocate under routes. `✓` marks what is
already in place.

```
app/
  layout.tsx  error.tsx  not-found.tsx
  (public)/   page.tsx
              recipes/page.tsx
              recipes/[id]/page.tsx           ← does not exist yet
  (admin)/    layout.tsx                      ← requireUser() gate, one place
              admin/page.tsx               ✓  ← server component, uses getRecipes()
                    _components/NewRecipeDialog.tsx  ✓  ← client, useActionState
  login/      page.tsx  _components/LoginForm.tsx
components/
  ui/                                      ✓  ← generated, untouched
  layout/     Navbar.tsx  Footer.tsx  ThemeProvider.tsx
  RecipeCard.tsx
lib/
  auth/     queries.ts  actions.ts  schema.ts   ✓
  recipes/  queries.ts  actions.ts  schema.ts   ✓
  supabase/ client.ts  server.ts  anon.ts  cookies.ts
  utils.ts                                   ✓
config/site.ts                                ← name + nav links
types/database.ts                             ← generated
```

---

## Suggested work order

Items 1–4 fix actual defects; the rest is structure.

1. ~~`lib/utils.ts` move + revert the 7 `components/ui` imports — issue 7 (unblocks shadcn)~~ **done**
2. ~~Delete `AddRecipeButton.tsx` and the unused default SVGs — issues 3, 9~~ **done**
3. ~~Auth reads → `lib/auth/queries.ts` with `cache()` — issue 1 (kills 2 of 3 round-trips)~~ **done**
4. ~~Admin write → server action + `updateTag` — issues 2, 3~~ **done**
5. `config/site.ts`, then collapse the two `Navigators` into one component — issue 5
6. `(public)` / `(admin)` route groups + admin auth gate — issue 6
7. Flatten `feature/` + `shared/` into colocated `_components/`, normalizing casing — issue 4
8. Generated database types — issue 8
9. Lint import order, delete the import comment blocks — conventions

**Unscheduled:** issue 10, the Supabase integration audit. Deferred on purpose — pick it up when
there's appetite for it, ideally together with issue 8 since both want the `supabase` CLI. The RLS
check inside it is the one part that is worth not leaving indefinitely, since RLS is the only thing
protecting writes.
