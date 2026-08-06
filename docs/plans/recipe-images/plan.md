# Plan: Recipe images

## Goal

Put photos into the recipe creator: **one image per method step, plus one cover image for the recipe
as a whole.** Uploaded from the wizard, stored in Supabase Storage, saved through the write path that
already exists.

This also builds the storage foundation the schema has been waiting on since 2026-08-01 — the bucket,
its policies, and a path convention — which [docs/image-storage.md](../../image-storage.md) has been
holding as an open question specifically until it was clear how the create form would handle uploads.
That question is now answered, so that document gets rewritten in place as a decisions record rather
than superseded by a new file: `CLAUDE.md` links to it from two sections, and a new file would leave
the stale one still linked.

## Non-goals

- **No gallery.** `recipe_images` supports many rows per recipe with `sort_order` and one primary; this
  writes exactly one, flagged primary. The payload is shaped as a list so a gallery later is a UI
  change and not a payload change.
- **No editing an existing recipe's images.** The wizard is create-only today. The draft shape chosen
  here is the shape an edit would hydrate into, so edit becomes wiring — but none of that wiring is in
  scope, and neither is deleting the file behind a replaced image.
- **No alt-text UI.** The column, the schema field and the payload all carry `alt`; the form always
  sends `null`. See Open questions.
- **No designed detail-page layout.** `RecipeArticle` gains the minimum honest rendering so the
  wizard's live preview does not lie about what is being published. Making it look good is its own job.
- **No orphan sweep.** Recorded as a future admin feature in
  [docs/known-issues.md](../../known-issues.md) instead — see Risks.

## Context

Read `CLAUDE.md` first for the wizard invariants, the `lib/<domain>/` layout rule and the Supabase
client table. What matters specifically here is how much of this already exists:

- **`recipe_steps.image_path` is already written by `save_recipe()`.** The function reads
  `item ->> 'image_path'` off each step in the payload today. **Step images require no SQL change at
  all** — they are a client-side change plus the bucket to put files in.
- **`recipe_images` exists and nothing writes it.** Columns `storage_path` (not null), `alt`,
  `sort_order`, `is_primary`, with a partial unique index allowing at most one primary per recipe.
- **`lib/supabase/browser-client.ts` exists and is unused**, kept for exactly this. Its entry in
  CLAUDE.md's client table says so.
- **`components/ui/attachment.tsx` was pulled from the shadcn registry in `d46ddb8`** and is not yet
  used. It already carries the five-state machine an upload needs
  (`idle` / `uploading` / `processing` / `error` / `done`), with the dashed idle border, the busy
  shimmer and the destructive error styling all wired to that one prop.
- **Both image columns store a path inside a bucket, not a URL.** That keeps the project id and CDN
  hostname out of the database. Preserve it.
- **There is no bucket, no Storage policy and no app code touching `supabase.storage`.**

The constraint that shapes everything below: **no `recipe_id` exists while the wizard is running.** A
recipe cannot be saved in pieces — `save_recipe()` writes the whole thing in one transaction — so the
id is not allocated until Review is submitted. The path convention suggested in `image-storage.md`,
`recipes/<recipe_id>/<uuid>.webp`, is therefore unbuildable at the moment a file is picked.

## Approach

**Upload eagerly, the instant a file is picked, to a flat `recipes/<uuid>.webp` path.** The browser
decodes the file, resizes it to 1600px on the long edge, re-encodes it as webp, and uploads it with
`browser-client.ts`. What lands in the wizard's draft is the resulting path string.

That last part is the whole point. The draft holds `image_path: string | null`, which is _precisely_
the field `save_recipe()` reads — so `toPayload()` passes it through untouched and the submit stays
exactly what it is today: one JSON blob, one transaction. It also preserves the wizard's load-bearing
invariant, that each step's ✓ parses the object which will actually be submitted. The alternative
considered most seriously — hold the `File` in memory and upload after the recipe exists, so paths can
be recipe-foldered — fails on both counts: it turns one atomic write into three independently-failing
phases, which is the exact hazard `save_recipe()` was written to eliminate, and it forces the draft to
hold a `File` that `toPayload()` cannot turn into a path, so the ✓ would be parsing something
materially different from what gets sent. It does not even buy what it appears to: a failure between
the uploads and the path write-back orphans files just the same. See decisions 4 and 5.

The cost accepted is that **abandoning the wizard after uploading leaves files in the bucket that no
row references.** An explicit ✕ deletes its file immediately, so the leak narrows to "closed the tab",
which for a single-owner site is a handful of files a year. The reconciliation feature that fixes it is
recorded as future work rather than built (decision 8).

Uploading from the browser rather than through a server action is not only about latency: a server
action on Vercel caps its request body at 4.5MB, which a single phone photo clears.

## Components

### Migrations

- **`supabase/migrations/<ts>_recipe_images_storage.sql`** — creates the `recipe-images` bucket by
  `insert into storage.buckets`, public, `file_size_limit` ~2MB, MIME allowlist `image/webp` only. Adds
  `insert` / `update` / `delete` policies on `storage.objects`, scoped to the `recipe-images` bucket
  and granted to `authenticated` and to nothing else. Read needs no `select` policy — the bucket being
  public serves the object URL directly.

  **The bucket must be made here, not in the dashboard.** The commented `[storage.buckets.images]`
  block in `supabase/config.toml` is a red herring: it configures the local Docker stack, which this
  project cannot run, and uncommenting it does nothing to the hosted project. A bucket created by
  clicking is invisible to migration history in exactly the way CLAUDE.md's Table Editor rule warns
  about.

  Expect the missing-policy failure mode to be confusing: RLS with no policies denies everything, so a
  forgotten `insert` policy looks like uploads silently failing while the site still renders fine.

- **`supabase/migrations/<ts>_save_recipe_images.sql`** — `create or replace function save_recipe`
  adding one block for the cover, mirroring the ingredients and steps blocks:

  ```sql
  delete from public.recipe_images where recipe_id = v_id;

  insert into public.recipe_images (recipe_id, sort_order, storage_path, alt, is_primary)
  select v_id, ord - 1,
         item ->> 'storage_path',
         nullif(trim(item ->> 'alt'), ''),
         coalesce((item ->> 'is_primary')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'images', '[]'::jsonb))
    with ordinality as t(item, ord);
  ```

  This is the extension the existing function's closing comment anticipated — one more key off the
  payload, no new parameter, no caller broken, exactly as CLAUDE.md mandates.

  Two traps in shipping it. `create or replace` restates the **entire body**, so the new file must
  carry the existing one verbatim plus this block; a copy that quietly loses the `if not found` guard
  turns an unwritable recipe back into a silent no-op. And re-state the `revoke` / `grant` lines at the
  bottom even though a pure replace preserves privileges — if the signature is ever changed it becomes
  a `CREATE`, and Postgres hands `execute` back to `public` by default, restoring `anon`'s ability to
  call it while the comment claiming otherwise stays in place.

### New files

- **`lib/supabase/storage.ts`** — the bucket name, the uuid path builder, the path-validation regex,
  and a pure `publicImageUrl(path)` that concatenates
  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${path}`.

  Pure rather than `getPublicUrl()`, which would mean instantiating a Supabase client inside server
  components purely to do string concatenation — it is the one storage call that touches no network,
  and keeping it client-free keeps the cached reads in `queries.ts` client-free too. The project id
  still never reaches the database, which was the point of storing paths.

  The path builder and the regex must be the single source of the convention: it is otherwise stated
  in two places and a change to one silently breaks saves.

- **`app/admin/_components/recipe-wizard/upload.ts`** — compress, upload, remove. Client-only and used
  by nothing outside the wizard, so it colocates with `draft.ts` rather than becoming a fourth file in
  `lib/recipes/`, which CLAUDE.md restricts to `queries` / `actions` / `schema`. `draft.ts` is the
  precedent.

  ```
  File  →  createImageBitmap(file, { imageOrientation: "from-image" })
        →  canvas, capped at 1600px on the long edge
        →  canvas.convertToBlob({ type: "image/webp", quality: 0.82 })
        →  supabase.storage.from("recipe-images").upload(`recipes/${crypto.randomUUID()}.webp`, blob)
  ```

  `imageOrientation: "from-image"` is not optional — see Risks.

  Removal calls `.remove([path])`. **If the remove fails, the draft field is cleared anyway.** An
  orphaned file is cheap; a draft still holding a path the user just deleted saves a recipe with an
  image they removed.

- **`app/admin/_components/recipe-wizard/ImageField.tsx`** — one component, both placements. Takes
  `value: string | null`, `onChange(path | null)`, an `onBusyChange`, an `onError`, and presentation
  props. Thin wrapper over `attachment.tsx`, mapping the pipeline onto its `state` prop:
  `processing` while the canvas works, `uploading` while the bytes go, `done` with the thumbnail in
  `AttachmentMedia variant="image"`, `error` with the message in `AttachmentDescription` and a retry.
  Adds a hidden `<input type="file" accept="image/*">` and drop handling; the registry component does
  the rest.

  **Set `type="button"` on every `AttachmentAction`.** `AttachmentTrigger` already defends itself
  ([attachment.tsx:108](../../../components/ui/attachment.tsx#L108)) but `AttachmentAction` is a shadcn
  `Button`, which sets no type and therefore defaults to `submit` inside a form. Harmless today, since
  neither placement sits on the one panel that has a `<form>` — but an image field reaching Review
  would turn "remove this photo" into "publish this recipe".

### Wizard changes

- **`draft.ts`** — `StepDraft` gains `image_path: string | null`; `Draft` gains `cover_path: string |
null`; both empties gain `null`. `toPayload()` passes `image_path` straight through and derives one
  new key:

  ```ts
  images: draft.cover_path ? [{ storage_path: draft.cover_path, alt: null, is_primary: true }] : [],
  ```

  `toPreview()` carries both through so the live preview shows them.

  **No sanitiser is added, and that needs a comment.** The rule in CLAUDE.md — a field with a
  validation rule and no keystroke sanitiser makes the tick lie — exists because inputs are _typed_.
  `ImageField` has no text input; it yields either `null` or a uuid path its own pipeline just built,
  so the invalid state is unreachable by construction rather than sanitised away. Without that written
  down, the next person either bolts a meaningless sanitiser onto a field with no keystrokes or decides
  the rule is optional.

- **`RecipeWizard.tsx`** — holds a `Set` of busy field ids and a map of per-field upload errors. The
  Publish button reads `isPending || slugTaken || busy.size > 0`. A `Set` rather than a counter so two
  concurrent uploads cannot double-decrement into a false "done".

  Both live here rather than in the field for the same reason `state.takenSlug` does: panels unmount
  when the step changes. Pick a photo on Method, hit Next before it lands, and the upload continues —
  the path still arrives, because the state is lifted. But a _failure_ would render into a component
  that no longer exists, leaving the user on Review with a disabled button and nothing explaining why.

  In-flight uploads are deliberately **not** folded into `complete[]`, for the reason already spelled
  out for `slugTaken` at
  [RecipeWizard.tsx:72-84](../../../app/admin/_components/recipe-wizard/RecipeWizard.tsx#L72-L84).

- **`DetailsPanel.tsx`** — the cover field, alongside title and description. Recipe-level metadata
  belongs where the rest of it is.

- **`StepsPanel.tsx`** — a `w-24` vertical `ImageField` inside each row's existing `flex-1 space-y-2`
  column, below the note input; a small dashed square when empty. Placing it inside that column rather
  than as a fourth element beside `RowControls` is what keeps the change to roughly one line: the row
  is already `[number][fields][controls]` and a fourth element makes the mobile layout a real problem,
  while nesting inherits the responsive behaviour that column already has.

- **`ReviewPanel.tsx`** — reports upload failures in the checklist that already explains what is
  blocking: _"Step 3's photo failed to upload. Go back and retry or remove it."_

### Schema, actions, reads

- **`lib/recipes/schema.ts`** — `stepSchema` gains `image_path`; a new `recipeImageSchema` covers
  `storage_path` / `alt` / `is_primary`; `images` joins `detailsSchema` (the cover field lives on the
  Details panel, and the schema's own comment says which step owns a field is a layout decision).

  Both path fields validate against the convention rather than accepting any string — a server action
  is a public HTTP endpoint, as [actions.ts:35-37](../../../lib/recipes/actions.ts#L35-L37) says of
  itself, so a posted path is no more trustworthy than a posted id. Read the pattern from
  `lib/supabase/storage.ts`, do not restate it.

  **The ✓ marks do not change.** Both fields are nullable, so a step with no photo parses exactly as it
  does today.

- **`lib/recipes/actions.ts`** — `deleteRecipe` gains file cleanup, in this order:

  1. read `recipe_images.storage_path` and `recipe_steps.image_path` for the recipe
  2. delete the recipe row, letting cascade take the children
  3. remove the files — best effort, never failing the action

  Step 1 must be first: once the row is gone, cascade has taken the only record of which files belonged
  to it. Step 2 before step 3 is the counterintuitive part and is deliberate — it guarantees that a
  half-failure lands on _files orphaned, rows gone_, which is harmless and is what the sweep exists
  for, rather than _files gone, rows still referencing them_, which is a live recipe rendering broken
  images. Same principle as the removal rule above: **every failure falls toward wasted bytes, never
  toward a broken reference.** A storage failure must not surface as an error either, because the
  recipe genuinely was deleted.

  Also **narrow the 23505 branch to the slug constraint by name.**
  `recipe_images_one_primary_idx` is a unique index, so two images flagged primary raise the same code
  that [actions.ts:100](../../../lib/recipes/actions.ts#L100) currently maps unconditionally to "the
  slug is taken". It cannot fire today — `toPayload` sends at most one image — but the moment a gallery
  exists an image bug reports itself as a title problem.

- **`lib/recipes/queries.ts`** — add `recipe_images(*)` to the shared `RECIPE_WITH_CHILDREN` constant,
  which covers `getRecipeBySlug` and `getDraftBySlug` in one edit. `getRecipes()` is a bare
  `select("*")` with no children, so `RecipeCard` showing a cover needs the join added there too.

- **`types/recipes.ts`** — `RecipeWithChildren` gains the images field, and the comment at
  [types/recipes.ts:22](../../../types/recipes.ts#L22) stating images are omitted on purpose must be
  removed rather than left as a lie.

- **`components/shared/RecipeArticle.tsx`** — the cover at the top, each step's photo under its
  instruction, plain `next/image`, no layout design. This is not scope creep: `PreviewRail` renders the
  real `RecipeArticle` on purpose, so without it the wizard's live preview would show a recipe missing
  the photos just uploaded. Its "images are absent on purpose" comment goes with it.

- **`components/shared/RecipeCard.tsx`** — the cover, if present.

- **`next.config.ts`** — `images.remotePatterns` for the Supabase hostname. Easy to forget and not
  optional: `next/image` throws on any remote host not listed.

### Docs

- **[docs/known-issues.md](../../known-issues.md)** — a new entry for orphaned storage files, naming
  its three sources (an abandoned wizard session, an image replaced once editing exists, a storage
  failure during delete), why it is accepted, and the wanted admin feature: list the bucket, diff
  against `recipe_images.storage_path ∪ recipe_steps.image_path`, delete what nothing references.

  **Record the age floor with it.** A file uploaded thirty seconds ago by a wizard that is still open
  is unreferenced but not orphaned, so a naive diff deletes a photo out from under a live editing
  session. Only objects older than roughly 24 hours are candidates. That is obvious now and will not be
  obvious to whoever picks the feature up.

- **[docs/image-storage.md](../../image-storage.md)** — rewritten in place from an open-questions
  document into a decisions record. Every one of its seven questions now has an answer, so left as-is
  it actively misleads. Its cascade-deletes-rows-not-files section stays — still true, and now with
  code depending on it.

- **`CLAUDE.md`** — three statements that this work falsifies:
  - the client table calls `browser-client.ts` "currently unused"; it becomes used, for uploads. The
    rest of that line — do not reach for it to fetch or mutate data — stays correct.
  - "Don't write cleanup code for child rows" needs its counterpoint sharpened, because `deleteRecipe`
    gains exactly that. Rows cascade, files do not; read literally, the current wording tells someone
    to delete the new code.
  - the wizard's sanitiser rule needs the by-construction carve-out described above.

- **[docs/permission-model.md](../../permission-model.md)** — a pointer, now that the model extends
  past the table boundary.

- **`docs/schema-current.html`** — regenerated by `npm run db:doc`, never hand-edited.

## Risks

- **EXIF orientation.** A portrait phone photo carries its rotation as metadata, not in the pixels.
  Drawn to a canvas without `imageOrientation: "from-image"`, every portrait photo comes out sideways
  — and it looks correct in the file picker beforehand, so it presents as a CSS bug. This is the single
  most likely way the pipeline ships broken. _Mitigation: the flag, and a portrait photo in the manual
  pass._
- **HEIC.** iPhones shoot it; Chrome and Firefox cannot decode it at all. The iOS picker usually hands
  over a converted JPEG, but sharing from Files does not. _Mitigation: `createImageBitmap` throws
  cleanly, so this becomes an explicit "this format can't be read, save it as JPEG first" rather than a
  blank thumbnail. Accepted as a message, not a conversion._
- **Storage policies cannot be verified locally.** No Docker, so no local stack — correctness is only
  observable against the linked project. _Mitigation: `npx supabase db query --linked` to inspect
  `storage.objects` policies, plus a real upload and a signed-out fetch in the manual pass._
- **Orphaned files accumulate.** Accepted; see decision 8 and the known-issues entry.
- **Unpublished recipes' photos are fetchable by URL** even though RLS hides the row. Accepted — uuids
  are unguessable — but it is a real divergence from how drafts behave everywhere else.
- **No upload progress percentage exists.** supabase-js `.upload()` is a `fetch` POST with no progress
  events; there is no `onUploadProgress` to reach for. The attachment shows an indeterminate shimmer.
  Worth knowing before an afternoon is spent looking for the callback.

## Open questions

- **Alt text has no entry point.** The column, the schema field and the payload all carry it; the form
  sends `null`. Fine for a personal site, an accessibility gap on a public one. Where it would go — the
  Details panel beside the cover, or the Review checklist — is unsettled.
- **The path convention lives in two places** (the builder and the validation regex), joined only by
  convention. Nothing enforces that they agree.
- **The sweep's 24-hour age floor is a guess.** It only needs to exceed the longest plausible wizard
  session.
- **Whether `getRecipes()` should join images at all**, or whether the list page is better served by
  denormalising a cover path onto `recipes`. Not worth deciding until the list page is actually slow.
