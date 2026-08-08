# Toolchain gotchas

Environment and dependency traps that cost real time here. Each one reads like a bug in your code
and isn't.

## Docker must be _running_, not just installed

`supabase db pull`, `db diff` and `db dump` each provision a local shadow Postgres. Docker Desktop
was installed on 2026-08-08, so all three work — **but only while the engine is up.** With it down
they fail at `Creating shadow database…`, which reads like a broken command and isn't; start Docker
Desktop and re-run. Closing the window doesn't stop it (it lives in the tray); _Quit_ does.

The first run pulls ~4.8 GB of Supabase images. Afterwards they're cached and a diff takes seconds.

**`supabase db diff` must be told `--linked`.** It defaults to `--local` and dies with
`ECONNREFUSED 127.0.0.1:54322`, hunting for a `supabase start` stack this project never runs.
`npm run db:diff` carries the flag; a bare `npx supabase db diff` does not.

What still works with the engine down, and why:

- `npm run db:push` — connects to Postgres directly. It prints a non-fatal Docker warning about
  caching a catalog _after_ it has already applied the migration, so the warning is not a failure.
- `npm run db:types` (`gen types --linked`) — goes through the Supabase API.
- `npx supabase db query --linked "<sql>"` — goes through the Management API, the same path the
  dashboard's SQL editor uses.

See [database-workflow.md](database-workflow.md) for what to do with those.

## eslint is pinned to the 9.x line on purpose — do not bump it to 10

`eslint-config-next` bundles `eslint-plugin-react`, whose latest release (7.37.5) declares
`eslint: ^3 … ^9.7`. Under ESLint 10 it crashes with
`contextOrFilename.getFilename is not a function`.

Revisit once `eslint-plugin-react` ships ESLint 10 support.

## Never run `npm audit fix --force`

`npm audit` reports advisories in `sharp`, `postcss` and `brace-expansion`. All are transitive
through `next` and `eslint` themselves, and `next` is already at the latest 16.2.12 — **there is
nothing to fix here directly.**

`--force` "fixes" them by installing `next@9.3.3`.

## A sick Turbopack dev cache can silently drop Tailwind utilities

**Symptom:** a component renders with correct-looking `class` attributes and no styling, because the
rule behind the class was never generated.

Restarting `next dev` does not fix it; `rm -rf .next` does. `npm run build` is unaffected, **which is
how you tell a cache problem from a real one** — if the production CSS has the rule and dev does not,
stop debugging your code.

Hit once, while adding `DifficultyBadge.tsx`, on the same `.next` that had already produced the
dead-worker 500s below. Both symptoms cleared together, so treat a `.next` that has misbehaved once
as suspect for everything afterwards.

**But don't build a habit of clearing `.next`.** A healthy cache picks up new files and new classes
hot, with no restart — that was re-tested afterwards and works.

## Turbopack's dead-worker 500

When the dev server's render workers die, **every** route 500s and the only log line is:

```
Error: Jest worker encountered N child process exceptions, exceeding retry limit
```

which swallows whatever actually threw. It reads as "this page is broken" when it means "this server
is broken" — a whole session was spent believing two working pages were broken.

**Restart `next dev` before believing a 500**, and `rm -rf .next` if it persists.

## Formatting

- The whole tree was formatted with prettier in one pass, so `npm run format:check` is clean. Keep it
  that way — run `npm run format` before committing rather than letting drift accumulate into another
  repo-wide reformat.
- `package-lock.json` is in `.prettierignore` on purpose: npm rewrites it with its own formatting on
  every install, so prettier and npm would fight over it forever.
- `proseWrap` is `"preserve"`, so prettier will not reflow prose in these docs — wrap by hand.
