# Image storage — open, needs investigation

**Status:** nothing is built. The schema has columns for images, there is no bucket, no Storage
policies, and no app code. This is not broken yet because nothing uses it — but it blocks the recipe
create form, which needs uploads.

Recorded 2026-08-01 so the gap isn't rediscovered later. Companion to
[permission-model.md](permission-model.md), whose model stops at the table boundary and does not
currently cover files.

## What exists today

**In the schema** — two columns pointing at files that don't exist yet:

- `recipe_images` — `storage_path` (not null), `alt`, `sort_order`, `is_primary`, one row per image,
  at most one primary per recipe.
- `recipe_steps.image_path` — nullable, an optional photo per step.

Both hold a **path inside a bucket, not a URL.** That is the right call — it keeps the project id and
CDN hostname out of the database, so the rows survive a project move and the URL shape can change
without a data migration.

**In the app** — nothing executable. No code reads `recipe_images`, constructs a public URL, or calls
`supabase.storage`. `lib/recipes/queries.ts` selects from `recipes` alone and doesn't join the images
table. The only references are inert: the `RecipeImage` type alias in `types/recipes.ts` (with a note
on `RecipeWithChildren` saying images are omitted on purpose), and a comment on `deleteRecipe` in
`lib/recipes/actions.ts` flagging the orphan trap below.

**In `supabase/config.toml`** — `[storage] enabled = true`, and a commented-out
`[storage.buckets.images]` example.

> **Don't be misled by that commented block.** `config.toml` configures the **local** dev stack —
> which this project never starts, Docker being installed or not. Uncommenting it does nothing to the
> linked hosted project. Buckets there are created in the dashboard or via SQL, and Storage policies
> are rows in `storage.objects` policies, applied like any other migration.

## Why it needs deciding rather than just doing

The permission model is "visitors read, admins write." That is enforced for **rows** by RLS on the
four recipe tables. **Storage is a separate policy system** — nothing written in the schema migration
applies to it. So the same rule has to be expressed a second time, on a different surface, and the
two ways of getting it wrong pull in opposite directions:

- **Private bucket, no read policy** → the public site renders broken images. Visitors can't fetch
  files, and the failure looks like a front-end bug rather than a permissions one.
- **Public bucket, no write policy** → world-readable is probably fine and likely what you want, but
  if insert/update/delete are left open, anyone can upload into the bucket or delete your photos.
  The publishable key is in every visitor's browser, so this is reachable from a browser console
  without touching the app.

## The trap: cascade deletes rows, not files

`on delete cascade` removes a recipe's `recipe_images` rows. **The files stay in the bucket forever.**
Postgres has no idea the bucket exists.

This is worth stating plainly because `CLAUDE.md` says not to write cleanup code for deletes — true
for rows, and false for files. Deleting a recipe therefore needs an explicit
`supabase.storage.from(...).remove([...])`, and the paths have to be read _before_ the row is deleted
or they're gone. Whatever the delete action ends up looking like, it needs to handle the
half-succeeded case: files removed but the row delete failed, or the reverse.

## Questions to answer when this is picked up

1. **Public bucket or signed URLs?** A personal recipe site is public content, so a public bucket is
   the obvious default — simple URLs, cacheable by the CDN, no expiry logic. The one thing it costs:
   images of an _unpublished_ recipe are reachable by URL even though the recipe is hidden. Probably
   irrelevant here since nobody knows the path, but it's a real difference from how RLS treats drafts,
   and worth a conscious yes rather than an accident.
2. **Who may write?** To match the table model: insert/update/delete for `authenticated` only, no
   grant of any kind to `anon`.
3. **Upload path from where?** Server action, or direct browser upload with `browser-client.ts` (the
   client that exists for exactly this and is currently unused). Direct upload avoids passing file
   bytes through the Next server; a server action keeps one code path and can validate first.
4. **Path convention.** Something stable and collision-proof — e.g. `recipes/<recipe_id>/<uuid>.webp`.
   Note recipe _slug_ is a bad path component: it's editable, and renaming would orphan every file.
   The `unique (recipe_id, storage_path)` constraint already assumes paths are unique per recipe.
5. **Limits and validation.** MIME allowlist and a size cap, set on the bucket rather than trusted
   from the client. `config.toml` shows the local default at 50MiB, which is far larger than a recipe
   photo needs.
6. **Resizing / format.** `[storage.image_transformation]` is commented out in `config.toml` and
   noted there as Pro-plan only, so on the free tier resizing has to happen before upload or via
   `next/image` at render time.
7. **Orphan cleanup**, per the trap above — plus what happens to files when an upload succeeds and the
   row insert fails.

## Suggested direction, not yet decided

Public bucket named `recipe-images`, read granted to everyone, write restricted to `authenticated`,
paths keyed by `recipe_id` and a uuid, MIME limited to jpeg/png/webp with a low single-digit MB cap,
and an explicit file-removal step in the recipe delete action. That's the smallest thing consistent
with the existing permission model — but it wants an actual look at how the create form will handle
uploads before it gets written into a migration.
