# CLAUDE.md

Personal recipe site ("Chique's Swiet Mofo") — Next.js 16 App Router + Supabase.
Public visitors browse recipes; a single owner logs in to add them.

Rules and traps live here. The reasoning behind them lives in `docs/`, linked per section.

## Commands

`npm run` scripts: `dev` · `build` · `lint` · `typecheck` · `format` · `format:check` · `db:pull` ·
`db:push` · `db:diff` · `db:types` · `db:doc`.

- **Run `lint` + `typecheck` before declaring work done.** All four checks pass on a clean tree; keep
  it that way.
- **There is no test suite.** Verify with `npx tsc --noEmit` plus a manual pass in `npm run dev`.
- **`db:pull` and `db:diff` need Docker Desktop actually running**, not merely installed — they build
  a throwaway shadow Postgres and replay every migration into it. If the engine is down they fail at
  `Creating shadow database…`. The first run pulls ~4.8 GB of images; later runs take seconds.
- **"failed to run docker. Docker Desktop is a prerequisite" can mean PATH, not Docker.** If it appears
  _after_ `Creating shadow database…` succeeds, the daemon is plainly fine: the diff step pulls its own
  image, the pull needs `docker-credential-desktop`, and that lives in
  `C:\Program Files\Docker\Docker\resources\bin` — on the machine PATH, but absent from any shell
  started before Docker was installed. Restart the terminal. A shadow container can be left running on
  port 54320 after such a failure and will block the next run; remove it.
- **`db:diff` carries `--linked` on purpose — don't drop it.** Bare `supabase db diff` defaults to
  `--local` and dies with `ECONNREFUSED 127.0.0.1:54322` looking for a local stack this project never
  runs.
- `npx supabase db query --linked "select …"` remains the way to inspect _rows_ — see
  [docs/database-workflow.md](docs/database-workflow.md).

## Environment

`.env.local` is required and gitignored — see `.env.example`. Without it every Supabase client
throws at import time and the app will not boot.

Both keys are `NEXT_PUBLIC_*` on purpose: the publishable key is safe client-side, so **row-level
security is the only thing protecting writes.** Do not add a service-role key without a deliberate
discussion.

## Layout

Import alias: `@/*` → repo root.

Each domain gets one folder under `lib/`, with the same three files:

```
lib/<domain>/queries.ts   reads — plain async, cache()'d or "use cache". Never "use server".
lib/<domain>/actions.ts   writes — "use server". Only async functions may be exported.
lib/<domain>/schema.ts    zod schemas + the useActionState state type.
```

`lib/auth/` and `lib/recipes/` both follow it in full; follow the same shape for new domains.
Route-specific **components** colocate under their route in `_components/`, but domain logic does
not — recipes are read from three routes.

Non-obvious files:

- `proxy.ts` — Next 16's renamed middleware; refreshes the Supabase session cookie.
- `types/database.ts` — GENERATED, don't hand-edit. Same for `components/ui/` (shadcn: regenerate).
- `lib/utils.ts` — path must match the `utils` alias in `components.json`.
- `app/admin/page.tsx` — redirects to `/admin/manage`. **Never link or redirect to `/admin`**; target
  `/admin/manage` directly. The route only survives a hard load — on Vercel, client-router `<Link>`
  navigation and server-action redirects to it both fail, and **it is invisible in dev.** Symptoms
  and cause are in the file's own comment.

`components/feature/` vs `components/shared/` is still being unwound. The target: route-specific
components colocate under their route, leaving `components/` for genuinely cross-route pieces
(`ui/`, the layout chrome, `RecipeCard`).

## Supabase clients — pick correctly

| File                             | Use from                          | Notes                                                                                         |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `lib/supabase/server-client.ts`  | server components, server actions | cookie-backed, `await createClient()` — this is the only one that knows who the user is       |
| `lib/supabase/public-client.ts`  | cached/unauthenticated reads      | no cookies, so it's safe inside `"use cache"`                                                 |
| `lib/supabase/browser-client.ts` | client components                 | **currently unused** — kept for realtime/uploads. Don't reach for it to fetch or mutate data. |

**Never use `server-client.ts` inside a `"use cache"` function** — reading cookies there is illegal
in Next 16. That's why `lib/recipes/queries.ts` uses the public client.

All three are typed with `<Database>`, so a misspelled column is a compile error. Keep the generic on
any new client.

## Database

Four tables — `recipes` (`slug` unique, `published`, …), plus `recipe_steps`, `recipe_ingredients`
and `recipe_images`, each keyed on `recipe_id`. Live schema:
[docs/schema-current.html](docs/schema-current.html) — **generated, don't hand-edit** (`npm run db:doc`,
also run by `db:types`).

- **`save_recipe(payload jsonb)` is the only write path** for a recipe and its children. Extend it by
  reading another key off the payload, never by adding parameters.
- **Never change structure in the Supabase Table Editor.** There is no drift detection — a clicked
  column is invisible to the migration history. The Table Editor is for _rows_ only.
- **Don't write cleanup code for child rows** — `on delete cascade` handles them. It does not delete
  the storage files those rows name; see [docs/image-storage.md](docs/image-storage.md).
- **Don't reintroduce hand-written row types.** `types/recipes.ts` derives from the generated types.

Migration loop, the `db query` escape hatch, destructive-migration gating, and why `save_recipe`
exists: [docs/database-workflow.md](docs/database-workflow.md). Open schema problems:
[docs/known-issues.md](docs/known-issues.md).

## The recipe wizard

`/admin/create` is a four-step wizard — Details · Ingredients · Steps · Review & Publish — over the
unchanged write path. Full spec and reasoning: `docs/plans/admin-create-wizard/`.

Four things are load-bearing and easy to undo by accident:

- **The step is client state, not a route or a query param.** A recipe cannot be saved in pieces, so
  per-step routes would advertise a durability `save_recipe()` does not have.
- **Steps 1–3 contain no `<form>` element; only the Review panel does.** One wrapping form would let
  a habitual Enter after typing the title save a one-field recipe. There is no `onKeyDown` guard —
  the element simply isn't there, which is why nothing _looks_ like it is preventing anything.
- **Each step's ✓ is that step's own `safeParse`** against the per-step schemas in
  `lib/recipes/schema.ts`, run on the payload that will actually be submitted. Never add a second
  notion of "complete" — the first version shipped ticking Details while Prep time held `abc`.
- **That only stays honest because every numeric input is sanitised at the keystroke** — see
  `recipe-wizard/draft.ts`. Add a field with a validation rule and no sanitiser and the tick goes
  green over a value the server rejects. **Nothing enforces this.** Where an invalid state can't be
  sanitised away (a title that slugifies to nothing), the wizard explains it on the panel instead.

The slug is derived from the title, never editable, and follows it forever — including on edit, where
a rename changes a live URL and `updateTag("recipes")` 404s the old one immediately. A collision asks
for a different title.

## Caching & rendering

`next.config.ts` sets `cacheComponents: true`. Cached reads use `"use cache"` + `cacheTag(...)`.

- **Invalidate with `updateTag("recipes")` in server actions** — read-your-own-writes, fresh on the
  same response. `revalidateTag(tag, profile)` only marks entries stale for a later refresh; it's for
  webhooks, not form submissions.
- **Request data fails the build, it doesn't degrade.** Cookie reads, `await params` in a page body,
  a server action bound to `<form action={…}>`, and `usePathname()` on a dynamic route all throw
  `StaticGenBailoutError`. Wrap them in `Suspense` — existing boundaries are load-bearing, not
  decoration.
- **There is no route-level escape hatch.** `export const dynamic = "force-dynamic"` is rejected
  under `cacheComponents`. When a build fails this way, `next build --debug-prerender` names the
  component; the default trace usually doesn't.

Cache lifetimes, each request-data trap with the file it bit, and the `/admin` prerender trade-off:
[docs/rendering-and-caching.md](docs/rendering-and-caching.md).

## Auth & permissions

- **Writes** — every mutating action calls `await requireUser()` before touching the database. Keep
  it in every new one. The one exception is deliberate: `checkSlugTaken` runs on a keystroke and
  `requireUser()` redirects, so it uses `getCurrentUser()` and reads nothing it wouldn't show a
  visitor.
- **Pages** — `app/admin/layout.tsx` renders `AdminGate` inside `Suspense`. New owner-only routes go
  under `app/admin/` so the gate covers them; don't repeat the check per page.
- **`/admin` is not hard-gated.** Its shell is flushed before the gate resolves, so an anonymous
  visitor briefly sees admin chrome. Nothing in that shell is private.
- **RLS is the real boundary**, not `requireUser()` — the publishable key ships to every browser, so
  anyone can call the Supabase API as `anon` directly.

**There are two roles, not three: visitor and admin.** Every logged-in account is an admin. Write
policies are `using (true)` and no table has a `user_id` — recipes are not owned by an account.
**Don't "fix" this by adding one.** The consequence: **public signups must stay disabled in Supabase
Auth**, because account creation is the only admission control.

Full model, including the rebuild path if personal accounts are ever added:
[docs/permission-model.md](docs/permission-model.md). Storage has separate policies and currently has
none — [docs/image-storage.md](docs/image-storage.md).

## Conventions

- Grouped import comments, in this order: `// import lib`, `// import actions`,
  `// import components`, `// import types`, `// import styles`
- Prettier: `printWidth: 200`, double quotes, semicolons, `trailingComma: "es5"`, LF. **Long JSX
  lines stay on one line** — that's intentional, not sloppy formatting.
- Server components by default; add `"use client"` only where state or effects are needed.
- Server actions validate with zod and return `{ error?: string }` for `useActionState` (see
  `lib/auth/actions.ts`); they `redirect()` on success. Only async functions may be exported from a
  `"use server"` file — schemas and types go in a sibling `schema.ts`.
- **Auth reads are not server actions.** `lib/auth/queries.ts` wraps `getCurrentUser` in React's
  `cache()` so navbar, footer and pages share one `auth.getUser()` per request.
- Tailwind v4 (CSS-first, no `tailwind.config`). Use the semantic tokens from `app/globals.css`
  (`bg-foreground/5`, `text-foreground`) rather than raw colors.
- Page shell pattern: `<section>` wrapper → tinted header band → `max-w-7xl mx-auto px-6 py-12` body.
- Filenames are inconsistent (`heroSection.tsx` vs `RecipeCard.tsx`). Prefer PascalCase for new
  files; don't churn existing ones.

The import-comment and filename conventions are both under review. Until that's settled, follow them
as written rather than drifting.

## Toolchain gotchas

Each of these reads like a bug in your code and isn't — details in
[docs/toolchain.md](docs/toolchain.md).

- **eslint is pinned to 9.x on purpose — do not bump it to 10.** `eslint-plugin-react` crashes under
  ESLint 10.
- **Never run `npm audit fix --force`** — it proposes installing `next@9.3.3`.
- **Restart `next dev` before believing a 500.** Turbopack's dead-worker error swallows the real one
  and 500s every route.
- **A sick `.next` can silently drop Tailwind utilities** — correct `class` attributes, no styling.
  `rm -rf .next` fixes it; `npm run build` is unaffected, which is how you tell. Don't make clearing
  `.next` a habit.
- Run `npm run format` before committing. `package-lock.json` is in `.prettierignore` on purpose.
