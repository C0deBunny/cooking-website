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
Actions/auth/       server actions ("use server") — note the capital A, root-level, not under app/
app/                routes: / , /login , /recipes , /admin
components/ui/      shadcn primitives (generated — regenerate, don't hand-edit)
components/feature/ feature components, grouped by area (hero, layout/navbar, layout/footer, login)
components/shared/  reused across features (RecipeCard, AddRecipeButton)
lib/data/           data access, server-only, cached
lib/supabase/       three clients — pick the right one, see below
lib/utils/utils.ts  cn() helper
types/              shared types
proxy.ts            Next 16's renamed middleware — refreshes the Supabase session cookie
```

Import alias: `@/*` → repo root.

## Supabase clients — pick correctly

| File                             | Use from                          | Notes                                                                                   |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `lib/supabase/server-client.ts`  | server components, server actions | cookie-backed, `await createClient()` — this is the only one that knows who the user is |
| `lib/supabase/browser-client.ts` | client components                 | used by `app/admin/page.tsx`                                                            |
| `lib/supabase/public-client.ts`  | cached/unauthenticated reads      | no cookies, so it's safe inside `"use cache"`                                           |

Never use `server-client.ts` inside a `"use cache"` function — reading cookies there is
illegal in Next 16. That's why `lib/data/recipes.ts` uses the public client.

## Caching

`next.config.ts` sets `cacheComponents: true`. Cached data functions use `"use cache"` plus
`cacheTag(...)` (see `lib/data/recipes.ts`). When you add a mutation that changes recipes,
call `revalidateTag("recipes")` — nothing currently does, which is why `/admin` fetches
client-side instead of reusing `getRecipes()`.

## Conventions

- Grouped import comments, in this order, used consistently across the codebase:
  `// import lib`, `// import actions`, `// import components`, `// import types`, `// import styles`
- Prettier: `printWidth: 200`, double quotes, semicolons, `trailingComma: "es5"`, LF.
  Long JSX lines stay on one line — that's intentional, not sloppy formatting.
- Server components by default; add `"use client"` only where state or effects are needed.
- Server actions validate input with zod and return a `{ error?: string }` state object for
  `useActionState` (see `Actions/auth/login.ts`); they `redirect()` on success.
- Styling is Tailwind v4 (CSS-first, no `tailwind.config`). Use the semantic theme tokens
  from `app/globals.css` (`bg-foreground/5`, `text-foreground`) rather than raw colors.
- Page shell pattern: `<section>` wrapper → tinted header band → `max-w-7xl mx-auto px-6 py-12` body.
- Component filenames are inconsistent (`heroSection.tsx` vs `RecipeCard.tsx`). Prefer
  PascalCase for new files; don't churn existing ones.

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
