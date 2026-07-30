# CLAUDE.md

Personal recipe site ("Chique's Swiet Mofo") — Next.js 16 App Router + Supabase.
Public visitors browse recipes; a single owner logs in to add them.

## Commands

```bash
npm run dev            # dev server (Turbopack) on :3000
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write .
npm run format:check   # prettier --check .
```

All four checks pass on a clean tree. Run `lint` + `typecheck` before declaring work done.

There is no test suite. Verify changes with `npx tsc --noEmit` plus a manual pass in `npm run dev`.

## Environment

`.env.local` is required and gitignored — see `.env.example`. Without it every Supabase
client throws at import time (`browser-client.ts`, `public-client.ts`) and the app will not boot.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both are `NEXT_PUBLIC_*` on purpose: the publishable key is safe client-side, so row-level
security in Supabase is the only thing protecting writes. Do not add a service-role key to
this project without a deliberate discussion.

## Layout

```
app/                routes: / , /login , /recipes , /admin
app/admin/layout.tsx  the owner-only gate — see "Auth gating" below
components/ui/      shadcn primitives (generated — regenerate, don't hand-edit)
components/feature/ feature components, grouped by area (hero, layout/navbar, layout/footer, login)
components/shared/  reused across features (RecipeCard)
lib/auth/           queries.ts (cache()'d reads) · actions.ts ("use server") · schema.ts (zod)
lib/recipes/        same three-file shape — see "Domain modules" below
lib/supabase/       three clients — pick the right one, see below
lib/utils.ts        cn() helper — path must match the `utils` alias in components.json
types/              shared types
proxy.ts            Next 16's renamed middleware — refreshes the Supabase session cookie
```

Import alias: `@/*` → repo root.

`components/feature/` vs `components/shared/` is still being unwound. The target: route-specific
components colocate under their route in `_components/`, leaving `components/` for genuinely
cross-route pieces (`ui/`, the layout chrome, `RecipeCard`).

## Domain modules

Each domain gets one folder under `lib/`, with the same three files:

```
lib/<domain>/queries.ts   reads — plain async, cache()'d or "use cache". Never "use server".
lib/<domain>/actions.ts   writes — "use server". Only async functions may be exported.
lib/<domain>/schema.ts    zod schemas + the useActionState state type.
```

`lib/auth/` and `lib/recipes/` both follow it; follow it for new domains too. Route-specific
**components** colocate under the route in `_components/` (e.g. `app/admin/_components/`), but
domain logic does not — recipes are read from three routes.

## Supabase clients — pick correctly

| File                             | Use from                          | Notes                                                                                         |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `lib/supabase/server-client.ts`  | server components, server actions | cookie-backed, `await createClient()` — this is the only one that knows who the user is       |
| `lib/supabase/public-client.ts`  | cached/unauthenticated reads      | no cookies, so it's safe inside `"use cache"`                                                 |
| `lib/supabase/browser-client.ts` | client components                 | **currently unused** — kept for realtime/uploads. Don't reach for it to fetch or mutate data. |

Never use `server-client.ts` inside a `"use cache"` function — reading cookies there is
illegal in Next 16. That's why `lib/recipes/queries.ts` uses the public client.

## Caching

`next.config.ts` sets `cacheComponents: true`. Cached data functions use `"use cache"` plus
`cacheTag(...)` — see `lib/recipes/queries.ts`. Without an explicit `cacheLife`, entries use the
`"default"` profile: stale 5m, revalidate 15m, no expiry. `npm run build` prints the window per
route, so a route showing `Revalidate 15m` is cached.

**Invalidating from a mutation — Next 16 split the API, pick the right one:**

- `updateTag("recipes")` — server actions only, read-your-own-writes. The value is fresh on the
  same response, so a form submitter sees their own change. This is what `lib/recipes/actions.ts`
  uses, and what you want for nearly every mutation here.
- `revalidateTag("recipes", profile)` — marks entries stale for a later background refresh. The
  second argument is **required** and it does not guarantee freshness on the next read. For
  webhooks and external syncs, not form submissions.

## Auth gating

Two layers, and they are not equivalent:

- **Writes** — `lib/recipes/actions.ts` calls `await requireUser()` before touching the database.
  This is the real boundary; keep it in every new action.
- **Pages** — `app/admin/layout.tsx` renders `_components/AdminGate.tsx` (a `requireUser()`
  side-effect component that returns `null`) inside `Suspense`. New owner-only routes go under
  `app/admin/`, so the gate covers them; don't repeat the check per page.

**The `Suspense` wrapper is load-bearing, not decoration.** With `cacheComponents: true`, a cookie
read that blocks the root shell fails the build with `StaticGenBailoutError` — a bare
`await requireUser()` at the top of the layout does exactly that. Same reason the navbar's
`getCurrentUser()` calls sit inside `Suspense`. Keep new request-data reads behind a boundary.

The cost, accepted deliberately: `/admin` stays partially prerendered, so its shell is flushed
before the gate resolves and the redirect arrives as a client-side `replace` to `/`. An anonymous
visitor sees admin chrome for a moment. Nothing in that shell is private — the recipe cards are the
same public list `/recipes` serves. **Don't describe `/admin` as hard-gated.** To harden it, opt the
route out of prerendering so the gate blocks and nothing ships until the user is known —
`getRecipes()` stays cached either way, so the only real loss is the static shell.

`requireUser()` is not a substitute for RLS, and neither is the gate. See the environment note above.

## Conventions

- Grouped import comments, in this order, used consistently across the codebase:
  `// import lib`, `// import actions`, `// import components`, `// import types`, `// import styles`
- Prettier: `printWidth: 200`, double quotes, semicolons, `trailingComma: "es5"`, LF.
  Long JSX lines stay on one line — that's intentional, not sloppy formatting.
- Server components by default; add `"use client"` only where state or effects are needed.
- Server actions validate input with zod and return a `{ error?: string }` state object for
  `useActionState` (see `lib/auth/actions.ts`); they `redirect()` on success. Only async functions
  may be exported from a `"use server"` file — schemas and types go in a sibling `schema.ts`.
- Auth reads are **not** server actions. `lib/auth/queries.ts` wraps `getCurrentUser` in React's
  `cache()` so the navbar, footer and pages share one `auth.getUser()` per request. Keep new reads
  out of `"use server"` files for the same reason.
- Styling is Tailwind v4 (CSS-first, no `tailwind.config`). Use the semantic theme tokens
  from `app/globals.css` (`bg-foreground/5`, `text-foreground`) rather than raw colors.
- Page shell pattern: `<section>` wrapper → tinted header band → `max-w-7xl mx-auto px-6 py-12` body.
- Component filenames are inconsistent (`heroSection.tsx` vs `RecipeCard.tsx`). Prefer
  PascalCase for new files; don't churn existing ones.

The import-comment and filename-churn conventions above are both under review. Until that's
settled, follow them as written rather than drifting from them.

## Dependency gotchas

- **eslint is pinned to the 9.x line on purpose — do not bump it to 10.** `eslint-config-next`
  bundles `eslint-plugin-react`, whose latest release (7.37.5) declares `eslint: ^3 … ^9.7`.
  Under ESLint 10 it crashes with `contextOrFilename.getFilename is not a function`. Revisit
  once eslint-plugin-react ships ESLint 10 support.
- `npm audit` reports advisories in `sharp`, `postcss`, and `brace-expansion`. All are
  transitive through `next` and `eslint` themselves, and `next` is already at the latest
  16.2.12 — there is nothing to fix here directly. **Never run `npm audit fix --force`**: it
  proposes "fixing" them by installing `next@9.3.3`.
- The whole tree was formatted with prettier in one pass, so `npm run format:check` is clean.
  Keep it that way — run `npm run format` before committing rather than letting drift
  accumulate into another repo-wide reformat.
- `package-lock.json` is in `.prettierignore` on purpose: npm rewrites it with its own
  formatting on every install, so prettier and npm would fight over it forever.
