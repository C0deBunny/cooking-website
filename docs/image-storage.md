# Image storage — decided and built

**Status:** built on 2026-08-08. There is a bucket, there are Storage policies, there is a path
convention, and the app uploads, renders and deletes files through them.

This document was an open-questions record from 2026-08-01 until then, held open deliberately until
it was clear how the create form would handle uploads. It is rewritten in place rather than
superseded because `CLAUDE.md` links to it from two sections, and a new file would leave the stale
one still linked. The full reasoning is `docs/plans/recipe-images/` — plan and decisions; this is
the summary a future reader needs before touching the bucket.

Companion to [permission-model.md](permission-model.md), whose model stops at the table boundary.
Storage is a **second** policy surface, and this is the half that covers it.

## What exists

**In the schema** — two columns, both holding a **path inside a bucket, not a URL.** That keeps the
project id and CDN hostname out of the database, so the rows survive a project move and the URL
shape can change without a data migration. Preserve it.

- `recipe_images` — `storage_path` (not null), `sort_order`, `is_primary`, one row per image, at
  most one primary per recipe. **There is no `alt` column**; it was dropped in
  `20260808140817_recipe_images_drop_alt.sql`. See "Alt text" below.
- `recipe_steps.image_path` — nullable, one optional photo per step.

**In the bucket** — `recipe-images`, created by `insert into storage.buckets` in
`20260808140816_recipe_images_storage.sql`: public, `file_size_limit` 2MiB, `allowed_mime_types`
`{image/webp}`.

**In the app**

- `lib/supabase/storage.ts` — the bucket name, the path builder, the validation pattern, and a pure
  `publicImageUrl(path)`.
- `app/admin/_components/recipe-wizard/upload.ts` — decode, crop, compress, upload, remove.
- `app/admin/_components/recipe-wizard/CropDialog.tsx` — the 1:1 crop picker.
- `lib/recipes/actions.ts` — `deleteRecipe` removes a recipe's files.

**In `supabase/config.toml`** — `[storage] enabled = true`, and a commented-out
`[storage.buckets.images]` example.

> **Leave that commented block alone.** `config.toml` configures the **local** dev stack, which this
> project never starts even though Docker is installed. Uncommenting it would create a _second_
> definition of the bucket that only a local stack reads, free to disagree with the migration on
> public, size limit and MIME list — and per the drift note below, nothing would compare them. The
> block is CLI boilerplate a future `supabase init` puts back; it is not deleted only because
> removing it would mean editing a file this work otherwise never touches.

## The seven questions, and their answers

**1. Public bucket or signed URLs?** Public. It buys URLs that `next/image` and the CDN can both
cache, with no signing, no expiry logic and no request-time work. The accepted cost: an
**unpublished** recipe's photos are fetchable by anyone holding the URL even though RLS hides the
row. Uuid paths make that unguessable, but it is a genuine divergence from how drafts behave
everywhere else, and it was accepted deliberately.

**2. Who may write?** `authenticated`, and nothing else — mirroring the four recipe tables. `anon`
is granted nothing at all, because rendering does not need it: the public object URL serves bytes
without touching `storage.objects`.

**3. Upload from where?** Straight from the browser, with `lib/supabase/browser-client.ts` — the
client that existed unused for exactly this. It wraps `createBrowserClient`, which is cookie-backed,
so the upload carries the signed-in JWT and meets the `authenticated` policies.

> A plain `createClient` holding its session in `localStorage` would upload as `anon` and fail with
> an RLS error that reads exactly like a broken policy. Worth knowing before debugging one.

Direct upload also sidesteps Vercel's 4.5MB cap on a server action's request body, which a single
phone photo clears.

**4. Path convention.** Flat: `recipes/<uuid>.webp`. No per-recipe folder — there is no `recipe_id`
while the wizard is running, since a recipe is not saved until Review. The folder would have existed
so a delete could wipe a prefix, and that was never going to work anyway: the rows are the only
record of which files belong to what, so a delete has to read the paths off them regardless.

No date or `covers/`/`steps/` prefix either: a prefix that carries meaning can become wrong, and a
uuid claims nothing. The prefix lives once in `PATH_PREFIX` in `lib/supabase/storage.ts`, with the
validation regex built from it, so the builder and the check cannot disagree.

**5. Limits and validation.** 2MiB and `image/webp` only, both on the bucket. Everything leaving the
browser is already webp, so the bucket physically rejects anything that bypassed the compression
pipeline — and nothing else enforces that pipeline, which lives in one client-side file.

> ⚠ **The MIME the bucket checks comes from the blob's own `type`, not from the `contentType`
> option.** For a `Blob` body supabase-js wraps it in `FormData` and never sets a content-type header
> at all, so `contentType` is silently ignored. `convertToBlob({ type: "image/webp" })` in
> `upload.ts` is therefore load-bearing on the _bucket policy_; passing `contentType` "to be safe"
> looks like a guard and is a no-op.

**6. Resizing / format.** In the browser, before upload: the crop rectangle is drawn to an
`OffscreenCanvas` at up to 1200px square and re-encoded as webp at quality 0.82.
`[storage.image_transformation]` is Pro-plan only, so server-side resizing was never an option;
`next/image` handles the rest at render time.

**7. Orphan cleanup.** Not built, deliberately, and recorded as
[known issue 4](known-issues.md). The ✕ control deletes its file immediately, which narrows the leak
to "closed the tab".

## The trap: cascade deletes rows, not files

`on delete cascade` removes a recipe's `recipe_images` rows. **The files stay in the bucket
forever.** Postgres has no idea the bucket exists.

Still true, and now with code depending on it. `CLAUDE.md` says not to write cleanup code for
deletes — true for rows, false for files. `deleteRecipe` therefore does, in this order, and the
order is the whole design:

1. **read** `recipe_images.storage_path` and `recipe_steps.image_path` — once the row is gone,
   cascade has taken the only record of which files belonged to it;
2. **delete the row**, letting cascade take the children;
3. **remove the files**, best effort, never failing the action.

Rows before files is the counterintuitive part. It fixes which way a half-failure falls: _files
orphaned, rows gone_ is harmless and is what the sweep exists for, while _files gone, rows still
referencing them_ is a live recipe rendering broken images at visitors. **Every failure falls toward
wasted bytes, never toward a broken reference** — the same rule governs the wizard's ✕ (which clears
the draft field even when the remove fails) and its replace control (which uploads the new file
before removing the old).

## `select` on `storage.objects` is required, not defensive

The bucket being public serves object _bytes_ over `/object/public/…`. It grants nothing on
`storage.objects`, which is an ordinary table with its own RLS. Rendering needs no policy — but
**deleting does**, and this was verified rather than reasoned:

- storage-api runs the user-facing delete **as the caller**, reaching
  `delete from storage.objects where bucket_id = $1 and name = any($2) returning *`;
- Postgres applies SELECT policies to that statement, because its `where` clause reads columns and
  it carries `returning`.

Probed on a throwaway table: with a permissive delete policy and **no** select policy, the delete
affects **zero rows**. So without the grant the ✕ removes neither the row nor the file, and
`.remove()` still returns `{ data: [], error: null }` — and since a storage failure is deliberately
silent, nothing would ever say so. The future sweep's `.list()` needs the same grant.

**How to check it end to end:** signed in on `/admin`, upload a small webp through the wizard, then
delete the recipe and confirm the object is gone from the bucket. A remove that reports success while
the file survives is this policy having regressed.

## Alt text: `alt=""`, and the column is gone

Both placements pass an empty alt, and that is the correct value rather than a placeholder for
future work. Under the hero the title is overlaid **on** the photo; a step photo sits directly
beneath the instruction that describes it. In both cases the accessible name is already adjacent and
a duplicate would be noise. `next/image` still requires the prop, so this is a decision about where
the string comes from, not whether one exists.

The column was dropped rather than left carrying `null` forever — a reader comparing the schema to
the code would otherwise assume the app had simply forgotten to write it.

## Drift: this bucket is outside every automatic check

`storage.buckets` holds **data**, not schema, so no diff engine sees the bucket row whatever the
scope — and the _policies_ are visible only under `npm run db:diff:storage`, which runs migra
because the default pg-delta engine prints `No schema changes found` over storage drift it cannot
see.

Full detail and the by-hand bucket query: [known issue 5](known-issues.md). `CLAUDE.md`'s "never
change structure in the dashboard" rule carries extra weight here for exactly that reason.
