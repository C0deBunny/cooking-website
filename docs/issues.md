# Known issues — architecture & layout

Findings from an architecture review of the initial setup (2026-07-28). The repo was scaffolded
by a trainee; the instincts are mostly sound but a few layout decisions are causing real defects
and others will as the app grows.

Items are ordered worst-first. The suggested work order is at the bottom — it differs from the
severity order because some cheap fixes unblock later ones. Fixed items are deleted from this file
once they land; the decisions they settled are recorded in `CLAUDE.md`, and the reasoning is in the
git history.

Status legend: `[ ]` open, `[x]` done. Update this file as items land — an issue only keeps a
`[x]` line while part of it is still open (issue 3 is the current example).

---

## 1. `components/feature/` vs `components/shared/` has already collapsed

- [ ] **Open**

The split forces a judgment call with no correct answer on every new component, and it has already
gone wrong:

- `RecipeCard` sits in `shared/` but is only used by the two recipe pages.
- The theme provider — which wraps the entire app — lives at
  `components/feature/layout/navbar/theme/NextThemesProvider.tsx`.

**Fix:** colocate route-specific components under their route in a `_components/` folder (the
leading underscore marks a private, non-routable folder in the App Router). `components/` then holds
only genuinely cross-route things: `ui/`, `layout/`, and the handful of shared pieces.

## 2. Duplicated navigation and site name

- [ ] **Open**

Two different files are both named `Navigators.tsx`
([navbar](../components/feature/layout/navbar/Navigators.tsx),
[footer](../components/feature/layout/footer/Navigators.tsx)) and both hardcode the nav links.
Adding a route means editing two files and hoping they match.

The site name `Chique's Swiet Mofo` is hardcoded in four places: layout metadata, both
`Navigators`, and [heroSection.tsx](../components/feature/hero/heroSection.tsx).

**Fix:** `config/site.ts` exporting the name and a `navLinks` array; one presentational nav
component consumed by both header and footer.

## 3. `/admin` is gated, but softly

- [x] **Gated** — [app/admin/layout.tsx](../app/admin/layout.tsx) renders
      [AdminGate](../app/admin/_components/AdminGate.tsx) (a `requireUser()` side-effect component)
      inside `Suspense`, so anonymous visitors are redirected to `/`. Verified against
      `next start`: `GET /admin` with no cookies returns `200` with `x-nextjs-postponed: 1` and
      `NEXT_REDIRECT;replace;/;307;` in the streamed payload.
- [ ] **Still soft** — the redirect lands _after_ the static shell, see below.

The write was already safe: `createRecipe` calls `requireUser()` before inserting, so an anonymous
POST is redirected regardless of RLS.

### Why the gate is Suspense-wrapped, and what that costs

`cacheComponents: true` forbids blocking the root shell with request data. Next's
`throwIfDisallowedDynamic` throws `StaticGenBailoutError` when the prelude is blocked and the route
has no `Suspense` above the body (`next/dist/server/app-render/dynamic-rendering.js`). A bare
`await requireUser()` at the top of the layout reads cookies and does exactly that — it would fail
the build. The navbar's `getCurrentUser()` calls only work today because
[Navbar.tsx](../components/feature/layout/navbar/Navbar.tsx) wraps them in `Suspense`.

So the gate sits inside its own boundary and `/admin` stays partially prerendered (`◐ /admin` with
`Revalidate 15m` in `npm run build`). The consequence: `.next/server/app/admin.html` is still a
prerendered shell — heading, "New Recipe" button and the cached recipe cards — and it is flushed
before the gate resolves. An anonymous visitor briefly sees admin chrome, then the client router
replaces to `/`. **Not a data leak** (those cards are the same public list `/recipes` serves) and
the write is separately guarded, but it is a soft gate, chosen deliberately over losing PPR.

**To harden later:** opt `/admin` out of prerendering so the gate blocks and nothing ships until the
user is known. `getRecipes()` stays cached either way, so the only real loss is the static shell.

### Route groups: not needed yet

An earlier draft of this file called for `(public)` / `(admin)` route groups. A plain
`app/admin/layout.tsx` gates `/admin` and everything under it identically, and route groups don't
change URLs, so the move stays free later. The group only starts paying off when an owner-only
surface lives at a different URL path — `/recipes/[id]/edit`, say. Put new admin routes under this
segment rather than repeating the check.

One thing left to confirm manually: that a signed-in owner still reaches `/admin` normally. Only the
anonymous path was verified end to end.

## 4. Database types are hand-written

- [ ] **Open**

[types/recipes.ts](../types/recipes.ts) is maintained by hand while the `supabase` CLI is already a
devDependency. A migration that renames a column currently fails in production instead of at
typecheck.

**Fix:** generate `types/database.ts` and derive
`type Recipe = Database["public"]["Tables"]["recipes"]["Row"]`. Drop the `Recipes = Recipe[]`
alias — `Recipe[]` reads better at call sites.

## 5. Smaller items

- [ ] `lib/supabase/browser-client.ts` and `server-client.ts` both export a function named
      `createClient`, making call sites ambiguous. Supabase's own convention is `client.ts` /
      `server.ts` / `anon.ts`, so the import path tells you which environment you're in.
- [ ] The cookie adapter is duplicated between [proxy.ts](../proxy.ts) and
      [lib/supabase/server-client.ts](../lib/supabase/server-client.ts). Extract it.
- [ ] `lib/supabase/browser-client.ts` is now unused — moving the admin write to a server action
      removed its last caller. Kept deliberately for things that genuinely need a browser client
      (realtime subscriptions, storage uploads). Delete it if those never materialise.
- [ ] No `app/error.tsx`, `app/not-found.tsx`, or `app/loading.tsx`.
- [ ] No recipe detail route (`/recipes/[id]`). Recipes also have no slug column.

## 6. Audit the Supabase integration end to end

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

Overlaps issue 4 — `supabase gen types` is part of the same sweep.

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
normalize. Recommendation: normalize to PascalCase now, as part of item 1.

---

## Target layout

Domain logic lives in `lib/<domain>/`; only components colocate under routes. `✓` marks what is
already in place.

```
app/
  layout.tsx  error.tsx  not-found.tsx
  page.tsx                                 ✓
  recipes/  page.tsx                       ✓
            [id]/page.tsx                     ← does not exist yet
  admin/    layout.tsx                     ✓  ← the gate, one place
            page.tsx                       ✓  ← server component, uses getRecipes()
            _components/AdminGate.tsx      ✓  ← requireUser(), must stay inside Suspense
            _components/NewRecipeDialog.tsx  ✓  ← client, useActionState
  login/    page.tsx  _components/LoginForm.tsx
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

The four defect fixes that came out of the original review have landed (`lib/utils.ts` +
shadcn imports, dead code and unused SVGs removed, auth reads deduped in `lib/auth/queries.ts`,
admin write moved to a server action with `updateTag`). What is left is structure:

1. `config/site.ts`, then collapse the two `Navigators` into one component — issue 2
2. Flatten `feature/` + `shared/` into colocated `_components/`, normalizing casing — issue 1
3. Generated database types — issue 4
4. The smaller items — issue 5
5. Lint import order, delete the import comment blocks — conventions
6. Harden the `/admin` gate by dropping the route's static shell — issue 3. Independent of the
   rest; do it whenever the soft gate stops being acceptable.

**Unscheduled:** issue 6, the Supabase integration audit. Deferred on purpose — pick it up when
there's appetite for it, ideally together with issue 4 since both want the `supabase` CLI. The RLS
check inside it is the one part that is worth not leaving indefinitely, since RLS is the only thing
protecting writes.
