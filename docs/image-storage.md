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
- `lib/recipes/actions.ts` — `deleteRecipe` removes a recipe's files; `saveRecipe` and
  `deleteRecipe` each schedule the orphan sweep in `after()`.
- `lib/images/sweep.ts` — the orphan sweep. **Deliberately not a server action**, and the only
  folder under `lib/` without CLAUDE.md's queries/actions/schema trio; see question 7.

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

**7. Orphan cleanup.** Built on 2026-08-09, in `lib/images/sweep.ts` — the ✕ control deletes its
file immediately, which narrowed the leak to "closed the tab", and this collects what is left.
[Known issue 4](known-issues.md) is closed; the reasoning is `docs/plans/orphan-image-sweep/`.

`sweepOrphans()` is scheduled with `after()` at the end of `saveRecipe` and `deleteRecipe` — the two
events that can have caused a leak. Running after the response is flushed means the owner waits for
nothing; running **inside the request's auth context** is what lets it use the ordinary cookie-backed
client, which is the whole reason this needed no service-role key and no scheduled job. Four filters
stand between the bucket and a delete, and each fails toward keeping a file: full enumeration → the
`IMAGE_PATH_PATTERN` gate → a seven-day age floor → a `security invoker` anti-join in Postgres. What
survives is capped at 25 per run, oldest first.

Three things are load-bearing and easy to undo:

- **It must never become a server action.** Every export from a `"use server"` file compiles to a
  public HTTP endpoint, and this one deletes files. That is why it sits in a plain module rather
  than in an `actions.ts`.
- **The `after()` in `saveRecipe` must be registered before `redirect()`,** which throws. Below that
  line it never registers, and nothing anywhere reports it.
- **The anti-join is only correct while `authenticated` reads every row** of `recipe_images` and
  `recipe_steps`. A row the caller cannot see is a reference the function does not find, and it
  answers "unreferenced" — so a narrowed SELECT policy turns the sweep on live photos. The warning
  is in the migration, where whoever narrows a policy will be.

**The residual cost**, which is why `CLAUDE.md` no longer calls orphaned files an accepted permanent
cost but does not call them solved either: an orphan lives at least seven days; nothing is collected
at all if the owner stops writing; and there is no page and no heartbeat, so a sweep that throws on
its first line looks exactly like one that had nothing to do. The probe below is the whole of the
evidence.

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

**The sweep's probe, same shape and same failure mode.** It is the only evidence the sweep works at
all, so run it before trusting a change to it — and re-run it whenever a regression is suspected:

1. Upload a photo through the wizard and close the tab, leaving one file nothing references.
2. Temporarily set `MIN_AGE_MS` to `0` in `lib/images/sweep.ts`. Without this there is nothing to
   see for a week, which is most of why the floor is a named constant.
3. Save any recipe, and read the `[orphan-sweep]` line in the server log.
4. Confirm the object is gone from the bucket, the log line names it — **and that the referenced
   files are still there.** The second half is the point; the first half only proves it ran.
5. Restore the constant.

A line reading `removed 0/1` is the `select` policy on `storage.objects` having regressed: same
cause as the ✕ control's probe above, which is why the sweep logs the returned count against the
requested one rather than just announcing what it asked for.

> ⚠ **There is no local stack — `npm run dev` sweeps the production bucket.** True of all storage
> work in this repo, and worth remembering the one time the floor is deliberately set to `0`.

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
