# Plan: Orphan image sweep

## Goal

Collect the files in the `recipe-images` bucket that nothing references, automatically, on the writes
that create them — with **no new credential and no new endpoint.**

Photos are uploaded the moment they are cropped, so a file exists before the recipe that names it
does. [known-issues.md](../../known-issues.md) issue 4 records the three ways that leaks — an
abandoned wizard tab, a replaced image once editing exists, and a storage failure during
`deleteRecipe` — and names the wanted fix as "list the bucket, diff against
`recipe_images.storage_path ∪ recipe_steps.image_path`, delete what nothing references". This plan
builds that diff and runs it from inside the two actions that can have caused a leak, rather than
from a screen someone has to remember to visit.

The eager upload itself is not revisited. It is what keeps the submit one JSON blob and one
transaction, and `docs/plans/recipe-images/decisions.md` decision 8 accepted orphaned files as its
price. This pays that price down; it does not renegotiate it.

## Non-goals

- **No admin page.** No orphan count, no manual sweep button, no new route under `/admin`. The
  automation is the trigger, and the cost — that a working sweep and a broken one look identical —
  is bought back with a written probe instead of a screen. Decisions 5 and 10.
- **No scheduled job.** No Vercel Cron, no Supabase Edge Function, no `pg_cron`. All three run with
  nobody signed in, so all three need a service-role key — which `CLAUDE.md` and `.env.example` both
  forbid without a deliberate discussion, and which would be a far larger change than the leak
  justifies. Decision 1.
- **No wizard-side cleanup.** No `beforeunload`, no `sendBeacon`, no delete-on-unmount. Rejected in
  known issue 4 for reasons that still hold, and an unmount effect fires on Fast Refresh.
- **No change to the upload pipeline, the crop dialog, or `save_recipe()`.** This adds a collector
  behind the existing design and touches nothing in front of it.
- **No edit path.** Known issue 7 stays open. The sweep will collect a replaced image's old file when
  editing arrives, without needing to know editing exists.

## Context

What already exists that this leans on:

- **Two columns hold every referenced path** — `recipe_images.storage_path` (not null) and
  `recipe_steps.image_path` (nullable). `deleteRecipe` already reads exactly this pair
  ([lib/recipes/actions.ts](../../../lib/recipes/actions.ts)), so the sweep is asking the same
  question that function already asks, over the whole bucket instead of one recipe.
- **`lib/supabase/storage.ts` owns the path convention** — `IMAGE_BUCKET`, `PATH_PREFIX` and
  `IMAGE_PATH_PATTERN`, the last built from the first so the builder and the validator cannot
  disagree. The sweep reuses the pattern rather than restating the shape.
- **The `select` policy on `storage.objects` is already granted** and is load-bearing for both halves
  of this — `.list()` needs it to enumerate, and `.remove()` needs it because storage-api's delete
  carries a `where` and a `returning`. [image-storage.md](../../image-storage.md) records the probe
  that established this.
- **RLS gives `authenticated` an unrestricted read** of both tables, while `anon` sees only published
  recipes' rows. Verified live on 2026-08-09:

  ```
  recipe_images  SELECT  {authenticated}  authenticated reads all images
  recipe_images  SELECT  {anon}           anon reads images of published recipes
  recipe_steps   SELECT  {authenticated}  authenticated reads all steps
  recipe_steps   SELECT  {anon}           anon reads steps of published recipes
  ```

  The unrestricted read is what makes the anti-join correct. See Risks.

- **`after()` is safe with the cookie-backed client.** `lib/supabase/server-client.ts` already wraps
  `setAll` in `try {} catch {}` — the standard SSR pattern, and the reason a client created after the
  response is flushed does not throw when it tries to refresh a cookie. That empty catch is now
  load-bearing and should say so.

Conventions — grouped import comments, zod-validated actions, `printWidth: 200` — are in `CLAUDE.md`
and are not restated here. The one convention this change _departs_ from is deliberate and is
decision 7.

## Approach

One plain module, `lib/images/sweep.ts`, called from `after()` at the end of `saveRecipe` and
`deleteRecipe`. `after()` runs the work once the response has been flushed, so the owner waits for
nothing, and it runs **inside the request's auth context** — which is the whole reason this needs no
service-role key. The two events that can leak a file are the two events that collect.

Between "every object in the bucket" and "files this run may delete" stand four independent filters,
each of which fails toward keeping a file rather than deleting one:

1. **Enumerate** the `recipes/` prefix with a paginated `.range()` loop. Full enumeration is
   unavoidable: in steady state the _oldest_ objects are old recipes' covers, referenced forever, so
   a "check the oldest page only" shortcut would never reach a real orphan.
2. **Gate on `IMAGE_PATH_PATTERN`.** Only paths shaped exactly like the ones this app builds are
   candidates. This also drops `.emptyFolderPlaceholder`, which `.list()` returns and a naive filter
   would cheerfully try to delete.
3. **Apply the age floor** — nothing younger than 7 days. This is the only thing standing between a
   second open wizard tab's uploaded photos and deletion.
4. **Ask Postgres** which candidates nothing references, through a `security invoker` anti-join RPC.
   The database answers about its own tables in one round trip, so a partial view of them cannot
   exist.

What survives is sorted oldest-first and truncated to 25, then removed. The cap is not a performance
knob — it bounds the damage if step 4 ever returns a wrong answer, and leaves the survivors as
evidence. Errors are swallowed and logged: the response is long gone, so there is no one to tell, and
a throw would flag a save that genuinely succeeded.

The alternatives that lost — a JS set-diff, a cron with a service key, a 24-hour floor, an admin page
— are in [decisions.md](decisions.md) with the reasoning.

## Components

- **`lib/images/sweep.ts`** — new. `sweepOrphans()`, the age floor and the cap as named constants, and
  the four filters. **Not `"use server"`, and nothing in it is exported through an action** — every
  export from a `"use server"` file compiles to a public HTTP endpoint, and this one deletes files.
  The file's own comment must say that, because the convention in `CLAUDE.md` reads as though it
  belongs in an `actions.ts`.
- **`supabase/migrations/<ts>_unreferenced_image_paths.sql`** — new. A `stable security invoker`
  function taking `text[]` and returning the subset nothing references. Execute is revoked from
  `public` and `anon`, then granted to `authenticated`: an anon caller sees only published recipes'
  rows, so it would get _more_ "unreferenced" answers than the truth — the dangerous direction. It
  cannot delete anything, but there is no reason to publish the oracle.
- **`types/database.ts` and `docs/schema-current.html`** — regenerated via `npm run db:types`, which
  also runs `db:doc`. Generated; not hand-edited.
- **`lib/recipes/actions.ts`** — two `after()` calls. In `saveRecipe` it must be registered **before**
  `redirect()`, which throws: put it after that line and it never registers, with no error to show for
  it. In `deleteRecipe` it goes after the best-effort `.remove()`, which is the call whose silent
  failure is one of the three documented leak sources.
- **[known-issues.md](../../known-issues.md)** — issue 4 closed, following issue 3's shape (struck
  heading, text kept as a record). Its residual caveat does not vanish with it; it moves to
  `image-storage.md`.
- **[image-storage.md](../../image-storage.md)** — question 7 rewritten from "Not built,
  deliberately"; `sweep.ts` added to the "In the app" list; the end-to-end probe section gains the
  sweep's recipe alongside the ✕ control's.
- **`CLAUDE.md`** — line 116's cascade bullet gains the second file-cleanup path; line 151 stops
  calling orphans a permanent accepted cost; the storage section gains the rule that the sweep must
  never become an exported action.

## Risks

- **A narrowed `select` policy silently inverts the failure direction.** A `security invoker`
  anti-join reports "unreferenced" for every row the caller cannot see. Correct today because
  `authenticated` reads all rows — but [permission-model.md](../../permission-model.md) contemplates
  per-account ownership as a rebuild path, and the day that lands, the sweep starts eating other
  people's live photos. Mitigation: state the dependency in the migration itself, not only here, and
  cap the blast radius at 25.
- **A future image column the RPC does not know about does the same thing.** A gallery, or a second
  photo per step, becomes a set of live paths the anti-join reports as unreferenced. Mitigation: the
  RPC is one place, in SQL, next to the schema — and the cap again.
- **Nothing is observable until roughly 2026-08-15.** Measured on 2026-08-09, every object in the
  bucket was created 2026-08-08, so the 7-day floor means the first several weeks of sweeps correctly
  collect nothing. With no page and no log-only deploy, a working sweep and one that throws on its
  first line are indistinguishable for that window. Mitigation: run the probe below before trusting
  it, not after.
- **The sweep only runs when the owner writes.** A bucket left alone keeps its strays indefinitely.
  Accepted: the leak is wasted bytes on a personal site, and the trigger is the same event that
  creates them.
- **A save in `npm run dev` sweeps the production bucket.** There is no local stack; every client
  points at the linked project. True of all storage work in this repo, and worth remembering the
  first time the probe is run with the floor lowered.
- **Neither lookup column is usefully indexed.** `recipe_images` is unique on
  `(recipe_id, storage_path)` — wrong leading column for a bare `storage_path =` — and
  `recipe_steps.image_path` has no index at all. Irrelevant at a few hundred rows under the
  `statement_timeout=8s` that `authenticated` carries; the thing to remember if a gallery ever makes
  this a mystery timeout.
- **Two concurrent saves run two sweeps.** Both may target the same path; the second `.remove()` is a
  no-op. Harmless, and not worth a lock.

## Verification

The measured starting state, 2026-08-09 — five objects, three referenced, two orphans, all created
2026-08-08:

```
recipes/ea7fcce3-6c10-4f8c-bd44-53852c1594cc.webp   unreferenced
recipes/0b136ba0-7699-4fc9-a27c-b9d030c2bca5.webp   unreferenced
recipes/e8957945-6d09-4330-9f13-883e30794435.webp   recipe_steps
recipes/342fe4c4-e212-4966-872d-82fa77459865.webp   recipe_images
recipes/630fa05f-acb1-4a03-a804-95f3adf138d2.webp   recipe_steps
```

That query _is_ the anti-join, run against real data, so the logic is confirmed before any of it is
written. It also fixes the first run's expected count at **2** — nowhere near the cap, so a cap hit
would be unambiguous from day one.

The probe, to be written into `image-storage.md` and re-run whenever a regression is suspected:

> Upload a photo through the wizard and close the tab. Temporarily set the age floor to `0`. Save any
> recipe, then confirm the object is gone from the bucket and the log line names it — and that the
> referenced files are untouched. Restore the constant. A sweep reporting success while the file
> survives is the `select` policy on `storage.objects` having regressed: same symptom, same cause, as
> the ✕ control's own probe above.

Plus `npm run lint` and `npm run typecheck`, per `CLAUDE.md`. There is no test suite.

## Open questions

- **RPC return shape** — `returns setof text` versus `returns text[]`. Affects only how the caller
  unwraps it.
- **Log line format.** Nothing reads these but a human in Vercel's log view, so it wants to be
  greppable and to say the count, the cap state, and the paths.
- **Hosted PostgREST `max_rows` is unverified.** No `pgrst.db_max_rows` is set on any role, and
  `supabase/config.toml` sets `1000` for the local stack this project never runs, so the effective
  hosted value is unknown. Moot under the RPC — which is partly why the RPC won — but worth knowing
  before writing any other bulk read.

## Assets

- [sweep-flow.html](assets/sweep-flow.html) — the four filters with worked counts, a healthy run
  against a broken one showing what the cap actually buys, and why the first run's backlog would have
  muddied the cap's signal had it been larger.
