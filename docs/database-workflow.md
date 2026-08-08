# Database workflow

How to change and inspect the schema, and the reasoning behind the one write path. Companion to
[schema-current.html](schema-current.html) (the live schema, generated),
[known-issues.md](known-issues.md) and [permission-model.md](permission-model.md).

Docker Desktop was installed on 2026-08-08, so `db:diff` and `db:pull` work — while the engine is
running. See [toolchain.md](toolchain.md) for that trap and for what still works without it.

## The loop for a schema change

```bash
npx supabase migration new <name>   # creates an empty timestamped file to write SQL into
npm run db:push                     # apply it
npm run db:types                    # regenerate types/database.ts AND docs/schema-current.html
npm run typecheck                   # the payoff: a dropped column breaks every reader
```

The schema lives in `supabase/migrations/` as hand-written SQL; `types/database.ts` is generated from
the live database. Both are committed.

**If the migration added or changed a constraint, index or policy, edit
`scripts/schema-annotations.json` in the same commit.** Generated types carry columns, types,
nullability, defaults, enums, functions and foreign keys — and nothing about `unique`, `check`,
partial indexes or RLS. That sidecar supplies the rest, and
[schema-current.html](schema-current.html) is built from the two together by
`scripts/gen-schema-doc.mjs` (`npm run db:doc` to run it alone).

The generator warns, on the console and in the page itself, when a table exists in one and not the
other — a second drift signal alongside `db:diff`. It writes no timestamp, so regenerating an
unchanged schema is a no-op in `git diff`.

## Drift detection — `npm run db:diff`

Builds a throwaway shadow Postgres, replays every migration into it in order, and compares the
result against the linked project. `No schema changes found` means the migration history and the
live database agree.

**Still never change structure in the Supabase Table Editor.** Drift is detectable now, but only
when someone runs the check — a clicked column still enters no migration file, and still nothing
warns you at the moment you click it. The Table Editor is for reading and editing _rows_ only.

## Inspecting without starting Docker

```bash
npx supabase db query --linked "select …"
```

runs arbitrary SQL against the live database, because it goes through the Management API rather than
a shadow Postgres. The CLI is already linked and authenticated. Still the quickest way in — no engine
to wait for, no container to build.

- That is the fastest way to inspect **data**.
- `npm run db:types` is the fastest way to inspect **schema**.

Reach for it before writing a migration that assumes a table is empty, and before asking someone to
go and click around the dashboard.

## Destructive migrations carry their own gate

A destructive migration should not rely on someone having run that check first.
`20260801190718_remove_ingredient_groups.sql` is the pattern: a `do $$ … raise exception $$` block,
placed **before** the destructive statements, that refuses to proceed if the data it is about to
destroy still exists.

## `save_recipe(payload jsonb) returns bigint`

The only write path for a recipe and its children.

**Why it exists:** Supabase JS sends every statement as its own transaction, so replacing children
with a `delete` plus an `insert` could leave a recipe with no steps.

**Why it is `security invoker`:** a `definer` function would bypass RLS entirely. It also sets
`search_path = ''` and has `execute` revoked from `anon`.

**How to extend it:** read another key off the payload rather than adding parameters, so existing
callers keep working.

## Constraints worth knowing

- Every child table's `recipe_id` is a real foreign key with `on delete cascade`, so deleting a
  recipe removes its steps, ingredients and images — **don't write cleanup code for that.** But
  cascade deletes _rows_, not the files those rows name; see [image-storage.md](image-storage.md).
- All three child tables are unique on `(recipe_id, <ordering column>)`, so a duplicate position
  fails at the database. `recipe_images` is additionally unique on `(recipe_id, storage_path)`, plus
  a partial unique index limiting each recipe to one `is_primary` row.
- None of those constraints is deferrable. That matters only for images — see issue 1 in
  [known-issues.md](known-issues.md) for why steps and ingredients escape it and what the fix
  options are.
- `difficulty` is a Postgres enum, which `db:types` emits as `"easy" | "medium" | "hard"`.
- `updated_at` is maintained by a trigger, not by the app.

## Don't hand-write row types

`types/recipes.ts` derives its aliases from the generated types
(`Database["public"]["Tables"]["recipes"]["Row"]`) rather than restating columns.

That is what caught a hand-written `description: string` disagreeing with a column that was always
nullable.
