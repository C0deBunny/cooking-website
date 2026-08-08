# Plan: Recipe images

## Goal

Put photos into the recipe creator: **one image per method step, plus one cover image for the recipe
as a whole.** Each one is cropped to a square **by the person uploading it**, in the browser, before
anything is stored — so the file on disk is already the final framing. Uploaded from the wizard,
stored in Supabase Storage, saved through the write path that already exists.

This also builds the storage foundation the schema has been waiting on since 2026-08-01 — the bucket,
its policies, and a path convention — which [docs/image-storage.md](../../image-storage.md) has been
holding as an open question specifically until it was clear how the create form would handle uploads.
That question is now answered, so that document gets rewritten in place as a decisions record rather
than superseded by a new file: `CLAUDE.md` links to it from two sections, and a new file would leave
the stale one still linked.

The UI half of this plan was worked out against three interactive mockups, all in `assets/` and linked
from [Assets](#assets). They are the reasoning, not decoration — the page-height numbers in decision 22
and the scroll-drift in decision 21 are only obvious when driven.

## Non-goals

- **No gallery.** `recipe_images` supports many rows per recipe with `sort_order` and one primary; this
  writes exactly one, flagged primary. The payload is shaped as a list so a gallery later is a UI
  change and not a payload change.
- **No editing an existing recipe's images.** The wizard is create-only today. The draft shape chosen
  here is the shape an edit would hydrate into, so edit becomes wiring — but none of that wiring is in
  scope.
- **No alt text, and the column goes with it.** `recipe_images.alt` is dropped rather than left
  carrying `null` forever. `next/image` still requires an `alt` prop, so this is a decision about
  _where the string comes from_, not whether one exists — see decision 27.
- **No phone support.** `/admin` stays desktop-first and the wizard is not made responsive, even though
  the photos it consumes come from a phone. Deliberate, and the tension is recorded in decision 28.
- **No broader detail-page redesign.** `RecipeArticle` gains a specified cover treatment and a step
  photo size, because the wizard's live preview renders the real component and would otherwise lie.
  Everything else about how a recipe page looks stays its own job.
- **No orphan sweep.** Recorded as a future admin feature in
  [docs/known-issues.md](../../known-issues.md) instead — see Risks.

## Context

Read `CLAUDE.md` first for the wizard invariants, the `lib/<domain>/` layout rule and the Supabase
client table. What matters specifically here is how much of this already exists — and how much of it
does not.

**Already there:**

- **`recipe_steps.image_path` is already written by `save_recipe()`.** The function reads
  `item ->> 'image_path'` off each step in the payload today. **Step images require no SQL change at
  all** — they are a client-side change plus the bucket to put files in.
- **`recipe_images` exists and nothing writes it.** Columns `storage_path` (not null), `alt`,
  `sort_order`, `is_primary`, with a partial unique index allowing at most one primary per recipe.
- **`lib/supabase/browser-client.ts` exists and is unused**, kept for exactly this.
- **`components/ui/attachment.tsx` was pulled from the shadcn registry in `d46ddb8`** and is not yet
  used. It already carries the five-state machine an upload needs
  (`idle` / `uploading` / `processing` / `error` / `done`), with the dashed idle border, the busy
  shimmer and the destructive error styling all wired to that one prop.
- **`dialog.tsx` is installed**, which the crop picker needs.
- **`Toaster` is mounted in `app/admin/layout.tsx`** and `toast` is the established way an admin
  mutation reports failure — see [RecipeRow.tsx:91](../../../app/admin/manage/_components/RecipeRow.tsx#L91).
- **Both image columns store a path inside a bucket, not a URL.** That keeps the project id and CDN
  hostname out of the database. Preserve it.

**Not there, and easy to assume otherwise:**

- **There is no bucket, no Storage policy and no app code touching `supabase.storage`.**
- **There is no cropper in the shadcn registry.** Checked. Any alternative to hand-writing it is a
  real third-party dependency rather than a registry copy-in.
- **There is no `slider.tsx`.** The crop dialog's zoom control needs it, or it is a bare
  `<input type="range">` that looks nothing like the rest of the UI.
- **`RecipeCard` has no media area at all.** It takes `{ title, description }`
  ([RecipeCard.tsx:3](../../../components/shared/RecipeCard.tsx#L3)), so a cover means changing its
  signature, not adding a prop.
- **`toPreview()` drops steps with no instruction**
  ([draft.ts:181](../../../app/admin/_components/recipe-wizard/draft.ts#L181)), which matters the
  moment a photo can be attached before the text is typed.
- **`PreviewRail`'s scroll effect depends only on `[step]`**
  ([PreviewRail.tsx:33-42](../../../app/admin/_components/recipe-wizard/PreviewRail.tsx#L33-L42)), so
  content arriving asynchronously moves the article underneath a scroll position computed without it.

The constraint that shapes the write path: **no `recipe_id` exists while the wizard is running.** A
recipe cannot be saved in pieces — `save_recipe()` writes the whole thing in one transaction — so the
id is not allocated until Review is submitted. The path convention suggested in `image-storage.md`,
`recipes/<recipe_id>/<uuid>.webp`, is therefore unbuildable at the moment a file is picked.

## Approach

**Pick a file, crop it to a square in a dialog, then upload eagerly to a flat `recipes/<uuid>.webp`
path.** The browser decodes the file, the user positions and zooms a 1:1 window over it, and the
resulting source rectangle is drawn to a canvas at up to 1200px, re-encoded as webp, and uploaded with
`browser-client.ts`. What lands in the wizard's draft is the resulting path string.

Cropping at upload is what makes the rest simple. Because the stored file is already the final framing,
**every surface renders it at 1:1 and nothing crops it again** — which deletes an aspect check, a
"this photo will be cropped" warning, and the whole question of which surface frames a photo how. The
wizard's thumbnail _is_ the published image. Decision 12's rule that the preview must not lie stops
needing mitigation and becomes true by construction, the same move `CLAUDE.md` already describes for
the sanitiser carve-out. The pipeline cost is one argument change: `drawImage` in its 9-argument
source-rect form instead of its 5-argument one. **The square is 1:1 rather than a wider frame** because
a 3:4 phone photo loses 58% of its height to 16:9 and only 25% to a square, and because a square is the
only ratio that behaves identically in a card grid and in a 19rem preview rail. See decisions 13 and 14.

**Uploading eagerly is what preserves the wizard's central invariant.** The draft holds a path, which
is precisely what `save_recipe()` reads, so the submit stays one JSON blob and one transaction. The
alternative considered most seriously — hold the `File` in memory and upload after the recipe exists,
so paths can be recipe-foldered — turns one atomic write into three independently-failing phases,
which is the exact hazard `save_recipe()` was written to eliminate, and forces the draft to hold a
`File` that `toPayload()` cannot turn into a path. It does not even buy what it appears to: a failure
between the uploads and the path write-back orphans files just the same. See decisions 4 and 5.

**Per-photo state lives on the row, as one union field, and everything else is derived.** `StepDraft`
gains a single `image` field that is `null`, or `{ status: "busy" }`, or `{ status: "done"; path }`, or
`{ status: "failed"; reason }`. Nothing is lifted into `RecipeWizard`, because it does not need to be:
"an upload is in flight" and "these photos failed" are computed from the draft the same way `payload`,
`preview`, `complete` and `missing` already are. This is not only tidier — it is the only shape in
which **deleting a step cannot leave state behind describing it.** A lifted `Set`/`Map`, keyed by
index or by a new id, both survive the row's deletion and go on reporting a failure for a step that no
longer exists, which blocks Publish with no reachable cause. See decision 18.

That settles where the state _lives_. Where it is _written back to_ is a second problem the same shape,
and the row gains a stable `id` for it: an upload resolves seconds after it starts, and the wizard's
only mutation primitive is positional, so a reorder mid-upload lands the finished path on the wrong
step and leaves the right one busy forever. See decision 31.

The cost accepted is that **abandoning the wizard after uploading leaves files in the bucket that no
row references.** An explicit ✕ deletes its file immediately, so the leak narrows to "closed the tab",
which for a single-owner site is a handful of files a year. The reconciliation feature that fixes it is
recorded as future work rather than built (decision 8).

Uploading from the browser rather than through a server action is not only about latency: a server
action on Vercel caps its request body at 4.5MB, which a single phone photo clears.

## Components

### Migrations

Three files, in any order — see the note under the third.

- **`<ts>_recipe_images_storage.sql`** — creates the `recipe-images` bucket by
  `insert into storage.buckets`, public, `file_size_limit` ~2MB, MIME allowlist `image/webp` only. Adds
  `select` / `insert` / `update` / `delete` policies on `storage.objects`, scoped to the
  `recipe-images` bucket and granted to `authenticated` and to nothing else.

  **`select` is on that list deliberately, and an earlier draft of this plan left it off.** The bucket
  being public serves object _bytes_ over `/object/public/…`; it grants nothing on `storage.objects`,
  which is an ordinary table with its own RLS. Rendering therefore needs no policy — but `.remove()`
  returns the rows it deleted, so it reads them first, and the sweep is a `.list()`, which is pure
  `select`. Without the grant, the ✕ that decision 8 leans on to narrow the orphan leak may remove
  nothing and report nothing, because a silent storage failure is the _designed_ behaviour under
  decision 11. Decision 33.

  **The bucket must be made here** — not in the dashboard, and not in `supabase/config.toml` either.
  `db reset` replays migrations into the local stack, so one `insert into storage.buckets` produces the
  bucket in both places from one source. Uncommenting the `[storage.buckets.images]` block would be a
  _second_ definition that only the local stack reads, letting local and hosted disagree on public,
  size limit and MIME list — and per the drift risk below, nothing would compare them. A bucket created
  by clicking is invisible to migration history in exactly the way CLAUDE.md's Table Editor rule warns
  about. Decision 42.

  Expect the missing-policy failure mode to be confusing: RLS with no policies denies everything, so a
  forgotten `insert` policy looks like uploads silently failing while the site still renders fine. That
  specific mistake is what the local `db reset` check in [Verification](#verification) exists to catch.

- **`<ts>_recipe_images_drop_alt.sql`** — `alter table public.recipe_images drop column alt;`

  Destructive, so it **carries its own gate**, per
  [docs/database-workflow.md:53](../../database-workflow.md#L53): a `do $$ … raise exception $$` block
  placed before the drop that refuses to proceed if any row has a non-null `alt`. Nothing has ever
  written the column, so the gate passes trivially — which is the point, since the gate is what makes
  that fact checked rather than assumed. The precedent to copy is
  [20260801190718_remove_ingredient_groups.sql:160](../../../supabase/migrations/20260801190718_remove_ingredient_groups.sql#L160),
  which drops `group_label` the same way and notes that `npm run db:types` afterwards turns every
  remaining reader into a compile error.

- **`<ts>_save_recipe_images.sql`** — `create or replace function save_recipe` adding one block for the
  cover, mirroring the ingredients and steps blocks:

  ```sql
  delete from public.recipe_images where recipe_id = v_id;

  insert into public.recipe_images (recipe_id, sort_order, storage_path, is_primary)
  select v_id, ord - 1,
         item ->> 'storage_path',
         coalesce((item ->> 'is_primary')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'images', '[]'::jsonb))
    with ordinality as t(item, ord);
  ```

  This is the extension the existing function's closing comment anticipated — one more key off the
  payload, no new parameter, no caller broken, exactly as CLAUDE.md mandates.

  **Never write `alt` in this block.** An earlier draft of this plan claimed the three migrations had a
  required order — that this one must land after the drop — and then gave the reason it cannot: the new
  block never touches `alt`, and `save_recipe` does not read `recipe_images` today, so neither order
  can break. The ordering rule was removed as a constraint with no force. What survives is the rule
  about one statement: do not add `alt` "for symmetry" with the ingredients and steps blocks, because
  the column is gone. Decision 34.

  Two further traps. `create or replace` restates the **entire body**, so the new file must carry the
  existing one verbatim plus this block; a copy that quietly loses the `if not found` guard turns an
  unwritable recipe back into a silent no-op. And re-state the `revoke` / `grant` lines at the bottom
  even though a pure replace preserves privileges — if the signature is ever changed it becomes a
  `CREATE`, and Postgres hands `execute` back to `public` by default, restoring `anon`'s ability to
  call it while the comment claiming otherwise stays in place.

### New files

- **`lib/supabase/storage.ts`** — the bucket name, the uuid path builder, the path-validation regex,
  and a pure `publicImageUrl(path)` that concatenates
  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${path}`.

  Pure rather than `getPublicUrl()`, which would mean instantiating a Supabase client inside server
  components purely to do string concatenation — it is the one storage call that touches no network,
  and keeping it client-free keeps the cached reads in `queries.ts` client-free too. The project id
  still never reaches the database, which was the point of storing paths.

  **One `PATH_PREFIX` constant, with the regex built from it**, so the convention cannot disagree with
  itself: `const PATH_PREFIX = "recipes/"`, the builder as `` `${PATH_PREFIX}${crypto.randomUUID()}.webp` ``,
  and the validation regex assembled from the same constant by template. The prefix is the part
  decision 5 says might change; the uuid shape and the extension are the parts nobody touches. This
  closes what was an open question rather than logging it — the file does not exist yet, so there is no
  reason to ship it with a known footgun. Decision 44.

  **Normalise a trailing slash once**, `.replace(/\/$/, "")` on the env var, or a stray `/` in
  `.env.local` yields `//storage/v1` and a 404 on every image — which reads as a storage problem rather
  than a one-character config typo. Decision 45.

- **`app/admin/_components/recipe-wizard/upload.ts`** — decode, crop, compress, upload, remove.
  Client-only and used by nothing outside the wizard, so it colocates with `draft.ts` rather than
  becoming a fourth file in `lib/recipes/`, which CLAUDE.md restricts to `queries` / `actions` /
  `schema`. `draft.ts` is the precedent.

  ```
  File  →  createImageBitmap(file, { imageOrientation: "from-image" })
        →  CropDialog, which returns { sx, sy, size } in source pixels
        →  canvas, min(1200, size) square
        →  drawImage(bitmap, sx, sy, size, size, 0, 0, out, out)
        →  canvas.convertToBlob({ type: "image/webp", quality: 0.82 })
        →  supabase.storage.from("recipe-images").upload(`recipes/${crypto.randomUUID()}.webp`, blob)
  ```

  **The decode happens before the dialog opens, and the dialog is painted from that bitmap** — never
  from an object URL on the raw `File`. This is not a preference; see Risks. `convertToBlob` is an
  `OffscreenCanvas` method, not `HTMLCanvasElement.toBlob` — use `OffscreenCanvas`.

  **`convertToBlob`'s `type` is what the bucket's MIME allowlist checks**, and this is not obvious.
  For a `Blob` body, supabase-js wraps it in `FormData` and never sets a content-type header at all, so
  the `contentType` upload option is **silently ignored** — the MIME the bucket sees comes from the
  multipart part, i.e. from `blob.type`. Two consequences worth a comment at the call site: passing
  `contentType: "image/webp"` looks like a guard and is a no-op, and dropping the `type` argument here
  (or switching to `canvas.toBlob` with a typo) produces a blob the bucket rejects with an opaque 400
  that reads exactly like the missing-policy failure above. Decision 32.

  **Pass `cacheControl: "31536000"`.** The library default is `"3600"`. Paths are uuids and a replace
  mints a new one, so the object at a path is immutable — an hour is not the CDN caching decision 6
  chose a public bucket to get.

  **Failures map to written messages before they reach the union's `reason`.** A small mapper here:
  401/403 → the sign-in expired and the photo needs re-attaching, 413 or the bucket size limit → too
  large after compression, the MIME rejection → the file was not accepted, everything else → a generic
  line carrying the raw message. Without it an expired session renders as
  `new row violates row-level security policy` on the Review panel of a cooking site. Route it through
  one helper, for the reason decision 25 gives about `slugTakenMessage`: the field and the Review alert
  both render this string and must not word it differently. Decision 46.

  Two ordering rules, both instances of the same principle:

  - **Removal:** if `.remove()` fails, the draft field is cleared anyway. An orphaned file is cheap; a
    draft still holding a path the user just deleted saves a recipe with an image they removed.
  - **Replacement:** upload the new file **first**, then remove the old best-effort, then hand back the
    new path. A failure at the upload leaves the original photo intact; a failure at the remove costs
    one orphan. The intuitive order — remove, then upload — loses the user's photo when the re-upload
    fails. Decision 24.

- **`app/admin/_components/recipe-wizard/CropDialog.tsx`** — a `Dialog` holding a square viewport, the
  bitmap positioned by transform, pointer-drag with `setPointerCapture`, wheel and slider zoom, and
  clamping so the image always covers the square. Confirm returns `{ sx, sy, size }` in source pixels;
  Cancel returns nothing and the field goes back to `idle`.

  **Pointer events, not mouse events**, or it is desktop-only at the code level as well as the route
  level. Cancel deliberately keeps nothing: retaining the `File` for a cheaper retry would mean a
  fourth field state holding a `File` that `toPayload()` cannot resolve, which is the shape decision 4
  rejected and which the union in `draft.ts` has no `status` for. Decision 29.

  A working prototype of the whole interaction, including the maths, is
  [assets/crop-prototype.html](assets/crop-prototype.html).

- **`app/admin/_components/recipe-wizard/ImageField.tsx`** — one component, both placements. Takes
  `value: StepImage`, `onChange`, and presentation props. Thin wrapper over `attachment.tsx`, mapping
  the pipeline onto its `state` prop: `processing` while the canvas works, `uploading` while the bytes
  go, `done` with the thumbnail in `AttachmentMedia variant="image"`, `error` with the message in
  `AttachmentDescription` and a retry. Adds a hidden `<input type="file" accept="image/*">` and drop
  handling; the registry component does the rest.

  Uses the **horizontal** orientation, capped at ~18–20rem, with the media bumped up from
  `attachment.tsx`'s `w-10` so the photo is actually visible. Not full width: the wizard's panel column
  is roughly 700px, which would be 94% chrome around a 40px thumbnail. Not the vertical variant either
  — `orientation="vertical"` is `w-24` but `has-data-[slot=attachment-content]:w-30`
  ([attachment.tsx:19](../../../components/ui/attachment.tsx#L19)), so the field would jump 96→120px
  when an error message appears and shove the row. Decision 16.

  Two idle presentations, and the difference is the only thing that varies between placements: the
  cover renders the full dashed attachment bar, a step renders a quiet `＋ photo` text button that
  becomes the bar once there is a file. Decision 17.

  **The thumbnail's bytes come from `publicImageUrl(path)`, not from the blob still in memory.** It is
  the only option that adds no state — the plan's "no new state at all" line and decision 18's
  derived-everything shape both survive, and the field surviving panel unmount is free rather than
  something to arrange. Storage is read-after-write consistent, so the object is there the moment
  `.upload()` resolves. The object-URL alternatives need `URL.revokeObjectURL` cleanup and are lost on
  unmount anyway, so the remote path has to work regardless and would only get exercised less.
  Decision 39.

  **Set `type="button"` on every `AttachmentAction`.** `AttachmentTrigger` already defends itself
  ([attachment.tsx:108](../../../components/ui/attachment.tsx#L108)) but `AttachmentAction` is a shadcn
  `Button`, which sets no type and therefore defaults to `submit` inside a form. Harmless today, since
  neither placement sits on the one panel that has a `<form>` — but an image field reaching Review
  would turn "remove this photo" into "publish this recipe".

### Wizard changes

- **`draft.ts`** — `StepDraft` gains **one** image field, not three, plus a stable `id`:

  ```ts
  export type StepImage = null | { status: "busy" } | { status: "done"; path: string } | { status: "failed"; reason: string };

  export type StepDraft = { id: string; instruction: string; note: string; image: StepImage };
  ```

  **The `id` is what an upload writes back through, and it is not optional.** The union puts the state
  on the row so a deleted row takes its state with it (decision 18) — but the completion still has to
  _find_ that row seconds later, and the only mutation primitive is `replaceAt(items, index, patch)`,
  which is positional. Start an upload on step 3, click ↑ on step 4, and the finished path lands on the
  wrong step while the genuinely busy one stays `{status:"busy"}` forever: `uploading` never clears,
  Publish is disabled permanently, and nothing on screen says why. So `draft.ts` gains a `replaceById`
  beside `replaceAt`, and the upload write-back uses it. Decision 31, which amends 18.

  **`EMPTY_STEP` and `EMPTY_DRAFT` become `newStep()` and `emptyDraft()`** — a shared constant spread
  with `{ ...EMPTY_STEP }` would clone one id onto every row. `RecipeWizard` switches to the lazy form
  `useState(() => emptyDraft())`. The id never leaves the client: `toPayload()` maps step fields
  explicitly, so it cannot reach the payload, and SSR generating different ids from hydration is
  harmless because it never reaches the DOM. On the edit path later, the real `recipe_steps.id`
  hydrates into the same field. It also fixes React's row keys, which are positional today.

  `Draft` gains `cover: StepImage`. Both empties gain `null`. `toPayload()` derives:

  ```ts
  steps: draft.steps.map((step) => ({ …, image_path: step.image?.status === "done" ? step.image.path : null })),
  images: draft.cover?.status === "done" ? [{ storage_path: draft.cover.path, is_primary: true }] : [],
  ```

  **This is the one place the plan gives up a literal pass-through, and it needs a comment.** Decision 4
  argued that the draft holding exactly the field `save_recipe()` reads is what keeps the submit
  honest. The substance survives — the draft holds a path and never a `File`, the submit is still one
  JSON blob and one transaction, and each ✓ still parses the payload rather than the draft — but the
  literal claim does not, and the next reader will notice. Say why: the union is what makes
  "has a path _and_ an error" unrepresentable, and what makes a deleted row take its own state with it.

  `toPreview()` carries both through, and **its step filter changes** to keep a step that has a photo
  even with no instruction yet: `step.instruction.trim() || step.image?.status === "done"`. Attaching a
  photo before typing is the natural order of work, and without this the preview shows no trace of a
  photo that is genuinely in the draft and genuinely about to be saved. The article renders
  `No instruction yet.` in `PLACEHOLDER_TEXT` beneath it — only ever reachable in the wizard, since the
  prop is off everywhere else. Decision 26.

  **No sanitiser is added, and that needs a comment too.** The rule in CLAUDE.md — a field with a
  validation rule and no keystroke sanitiser makes the tick lie — exists because inputs are _typed_.
  `ImageField` has no text input; it yields either `null` or a path its own pipeline just built, so the
  invalid state is unreachable by construction rather than sanitised away. Without that written down,
  the next person either bolts a meaningless sanitiser onto a field with no keystrokes or decides the
  rule is optional.

- **`RecipeWizard.tsx`** — **no new state at all.** Two `useMemo`s beside the existing ones:

  ```ts
  const uploading = draft.cover?.status === "busy" || draft.steps.some((s) => s.image?.status === "busy");
  const failedPhotos = draft.steps.flatMap((s, i) => (s.image?.status === "failed" ? [{ step: i + 1, reason: s.image.reason }] : []));
  ```

  The Publish button reads `isPending || slugTaken || uploading`. In-flight uploads are deliberately
  **not** folded into `complete[]`, for the reason already spelled out for `slugTaken` at
  [RecipeWizard.tsx:72-84](../../../app/admin/_components/recipe-wizard/RecipeWizard.tsx#L72-L84): each
  ✓ is that step's own `safeParse` and nothing else, and an upload in flight is an asynchronous fact
  about the world rather than a property of the data's shape.

  Panels unmounting on step change is handled for free, because the draft outlives the panel — which is
  the second reason the state belongs on the row rather than in the component that renders it.

- **`DetailsPanel.tsx`** — the cover field sits **to the right of the title and description**, in a
  two-column grid spanning both rows, so it costs no vertical space at all. Above the title would put
  an optional field before the only required one; below the description pushes difficulty and the times
  off a laptop screen. Needs a stacking rule below roughly 640px, which this panel does not have today.
  Decision 19.

- **`StepsPanel.tsx`** — a `＋ photo` button under the note input in each row's existing
  `flex-1 space-y-2` column, expanding into the attachment once a file exists. Placing it inside that
  column rather than as a fourth element beside `RowControls` inherits the responsive behaviour that
  column already has.

- **`ReviewPanel.tsx`** — upload failures feed the **existing `role="alert"` block**
  ([ReviewPanel.tsx:71-84](../../../app/admin/_components/recipe-wizard/ReviewPanel.tsx#L71-L84)), with
  a "Back to Method" button mirroring the existing "Back to Details". The checklist is untouched and its
  green `Check` stays a constant: each step's ✓ genuinely parses, so the step _is_ complete and only its
  photo failed. Route both messages through one helper, as `slugTakenMessage` already does, so the
  wording cannot drift. Decision 25.

### Schema, actions, reads

- **`lib/recipes/schema.ts`** — `stepSchema` gains `image_path`; a new `recipeImageSchema` covers
  `storage_path` and `is_primary` and **not `alt`**; `images` joins `detailsSchema` (the cover field
  lives on the Details panel, and the schema's own comment says which step owns a field is a layout
  decision).

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
  images. Same principle as the removal and replacement rules above: **every failure falls toward
  wasted bytes, never toward a broken reference.** A storage failure must not surface as an error
  either, because the recipe genuinely was deleted.

  Also **narrow the 23505 branch to the slug constraint by name** —
  `error.code === "23505" && error.message.includes("recipes_slug_key")`, with a comment saying plainly
  that this is a string match against a Postgres-generated message. **Five unique constraints are
  reachable through `save_recipe`, not two:** `recipes_slug_key`, the two child ordering constraints
  (which `with ordinality` makes unreachable), `recipe_images (recipe_id, storage_path)` and the partial
  `recipe_images_one_primary_idx`. Both image constraints raise the same code that
  [actions.ts:100](../../../lib/recipes/actions.ts#L100) currently maps unconditionally to "the slug is
  taken". Neither can fire today — `toPayload` sends at most one image — but the moment a gallery exists
  an image bug reports itself as a title problem. Decision 35.

- **`lib/recipes/queries.ts`** — add `recipe_images(*)` to the shared `RECIPE_WITH_CHILDREN` constant,
  which covers `getRecipeBySlug` and `getDraftBySlug` in one edit.

  `getRecipes()` is a bare `select("*")`, and it gets a **narrow, primary-filtered embed** rather than
  the same one: `select("*, recipe_images(storage_path)")` with `.eq("recipe_images.is_primary", true)`.
  The filter is what keeps the embed one row per recipe once a gallery exists, so `RecipeCard` never has
  to pick, and the narrow column list ships one string instead of every image column to a card that
  needs one string. `getRecipesForAdmin` is untouched — the manage page shows no covers. Decision 36.

- **`types/recipes.ts`** — three changes, and only the first was in the original plan.

  `RecipeWithChildren` gains the images field, and the comment at
  [types/recipes.ts:22](../../../types/recipes.ts#L22) stating images are omitted on purpose must be
  removed rather than left as a lie.

  **A new `RecipeListItem`**, because `getRecipes()` returns `Recipe[]` — a bare table row — and any
  embed changes that type:
  `RecipeListItem = Recipe & { recipe_images: Pick<RecipeImage, "storage_path">[] }`.

  **`RecipeView` gains a flat `cover: string | null`, and its steps gain `image_path`.** This is the
  type `RecipeArticle` actually takes, via `toRecipeView()` and the wizard's `toPreview()` — the
  original plan named only `RecipeWithChildren` and never this. Flat rather than row-shaped because
  `RecipeView`'s own comment says it is deliberately narrower than a row so an unsaved recipe can be
  rendered without inventing the parts a row would have; carrying `recipe_images[]` would make the
  wizard fabricate a one-element list of fake image rows, which is the exact pattern that comment
  exists to prevent. `toRecipeView()` resolves the primary
  (`find((i) => i.is_primary)?.storage_path ?? null`); `toPreview()` reads the draft's union. The
  article never learns that a `recipe_images` row exists. Decision 37.

- **`components/shared/RecipeArticle.tsx`** — three specified changes, and nothing beyond them:

  - **The cover becomes an overlaid square hero at column width.** A 1:1 image inside `max-w-3xl`
    (768px), centred, with the difficulty badge, title and meta row sitting on it over a scrim. Not
    viewport-wide: a square that wide is that tall, so a full-bleed version would put everything else
    below the fold, and the obvious bound (`max-h` plus `object-cover`) would re-crop the square the
    user just framed. Column-bleed keeps the crop guarantee at every width with no new layout rule,
    since the article is already `max-w-3xl` throughout. Decision 20.
  - **With no cover, and `placeholders` on, the square is reserved** as an empty dashed frame with the
    title on it — no scrim, dark text. With `placeholders` off, a coverless recipe falls back to
    today's tinted band. That fork follows a line that already exists and whose comment already draws
    this exact distinction, and reserving the space in the wizard is what makes the scroll drift below
    unreachable rather than merely handled. Decision 21.
  - **Step photos render at roughly 300px square**, beneath the instruction and indented to the text
    column. Full column width would make each step its own screen and stop the method reading as a
    sequence — at six steps that is a nine-screen page. 300px is large enough to read as a photograph
    and small enough that two or three steps share a screen. Decision 22.

  This is not scope creep: `PreviewRail` renders the real `RecipeArticle` on purpose, so without it the
  wizard's live preview would show a recipe missing the photos just uploaded. Its "images are absent on
  purpose" comment goes with it.

  Pass **`alt=""`** in both placements, with a comment saying why: under the hero the title is
  overlaid on the photo, and a step photo sits directly beneath the instruction that describes it, so
  in both cases the accessible name is already adjacent and a duplicate would be noise. This is the
  correct value, not a placeholder for future work — the dropped column's own comment
  ([initial_schema.sql:149-151](../../../supabase/migrations/20260801122716_initial_schema.sql#L149-L151))
  made the same argument before any of this existed.

- **`components/shared/RecipeCard.tsx`** — gains a 1:1 media area. A recipe **without** a cover gets a
  generated tile instead: a square tinted from the slug with the title's first letter. Every existing
  recipe has no cover, so a mixed grid is the state of the site the day this ships rather than an edge
  case — a dashed placeholder would announce a gap to visitors six times over, and omitting the media
  entirely leaves the grid ragged for as long as the library is mixed. Decision 23.

- **`next.config.ts`** — `images.remotePatterns` for the Supabase hostname, **derived from the env var**
  with `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname` rather than hardcoded or wildcarded.
  One source with `storage.ts`, and it survives a project move — the same reason the columns store paths
  rather than URLs. A `*.supabase.co` wildcard would also let any Supabase project's images through the
  optimizer. The cost is that `next.config.ts` now reads env at build time, so a missing variable fails
  the build; that is the posture the Supabase clients already take at import. Easy to forget and not
  optional either way: `next/image` throws on any remote host not listed. Decision 45.

  **`next/image` earns its place here despite the file already being final.** Decisions 3 and 13 make
  the stored object a 1200px square webp, which genuinely does undercut most of what the optimizer is
  for — so this was checked rather than assumed. The deciding case is decision 22's 300px step photo:
  serving the 1200px file into a 300px slot is roughly 250KB against 40KB, and six steps make that
  1.5MB against 240KB. Intrinsic width and height also mean a landing photo cannot shift the article,
  which matters given decision 21 reserves space for exactly that hazard. Decision 38.

- **`PreviewRail.tsx`** — unchanged, and that is a consequence rather than an oversight. Reserving the
  cover square (decision 21) means the article's geometry does not change when a photo lands, so the
  effect's `[step]`-only dependency stays correct. Had the empty state been a line of text or nothing
  at all, `recipe.cover` would have had to join the dep array.

### Docs

- **[docs/known-issues.md](../../known-issues.md)** — a new entry for orphaned storage files, naming
  its three sources (an abandoned wizard session, an image replaced once editing exists, a storage
  failure during delete), why it is accepted, and the wanted admin feature: list the bucket, diff
  against `recipe_images.storage_path ∪ recipe_steps.image_path`, delete what nothing references.

  **Record the age floor with it.** A file uploaded thirty seconds ago by a wizard that is still open
  is unreferenced but not orphaned, so a naive diff deletes a photo out from under a live editing
  session. Only objects older than roughly 24 hours are candidates. That is obvious now and will not be
  obvious to whoever picks the feature up.

  A second entry for **no phone support on `/admin`**, with decision 28's reasoning, so the mismatch
  between "compress in the browser because phone photos are 4–12MB" and "you cannot use this from a
  phone" is written down rather than rediscovered.

  A third for **storage having no drift detection**, per decision 43 and the risk below.

- **[docs/image-storage.md](../../image-storage.md)** — rewritten in place from an open-questions
  document into a decisions record. Every one of its seven questions now has an answer, so left as-is
  it actively misleads. Its cascade-deletes-rows-not-files section stays — still true, and now with
  code depending on it.

  **Two things the rewrite must not carry forward.** Its `config.toml` note says the local dev stack
  "needs Docker — unavailable in this project", which stopped being true on 2026-08-08; the conclusion
  it supports is still right but needs decision 42's reason instead. And its suggested direction —
  `recipes/<recipe_id>/<uuid>.webp`, jpeg/png/webp — is superseded by decisions 5 and 7 rather than
  merely unaddressed. **Add** the storage-drift gap from decision 43, since this is the document
  someone will read before touching the bucket.

- **`CLAUDE.md`** — a new `db:reset` script joins the Commands list (decision 41), and five statements
  that this work falsifies:
  - the client table calls `browser-client.ts` "currently unused"; it becomes used, for uploads. The
    rest of that line — do not reach for it to fetch or mutate data — stays correct.
  - "Don't write cleanup code for child rows" needs its counterpoint sharpened, because `deleteRecipe`
    gains exactly that. Rows cascade, files do not; read literally, the current wording tells someone
    to delete the new code.
  - the wizard's sanitiser rule needs the by-construction carve-out described above.
  - the four-table description should note that `recipe_images.alt` is gone, since a reader comparing
    the doc to the generated schema would otherwise assume drift.
  - the Database section's drift warning is about the Table Editor and the four recipe tables. Storage
    needs its own line, because `db:diff` does not cover it and the bucket is a row (decision 43).

- **[docs/permission-model.md](../../permission-model.md)** — a pointer, now that the model extends
  past the table boundary.

- **`docs/schema-current.html`** — regenerated by `npm run db:doc`, never hand-edited.

## Risks

- **EXIF orientation, now with a sharper edge.** A portrait phone photo carries its rotation as
  metadata, not in the pixels. An `<img>` applies it automatically — browsers default to
  `image-orientation: from-image` — but `createImageBitmap` does **not** without the flag. Paint the
  crop dialog from an object URL and confirm the crop against a decoded bitmap, and the output is
  rotated _and_ offset: the rectangle was computed against one orientation and applied to another.
  That is worse than the pre-cropper version of this risk, where the failure was merely a sideways
  photo. _Mitigation: the ordering rule in `upload.ts` — decode with
  `imageOrientation: "from-image"` first, paint the dialog from that bitmap, never put the raw `File`
  in an `<img>`. Plus a portrait photo in the manual pass._
- **HEIC.** iPhones shoot it; Chrome and Firefox cannot decode it at all. The iOS picker usually hands
  over a converted JPEG, but sharing from Files does not. `createImageBitmap` throws cleanly, so this
  becomes an explicit message. _Mitigation: a `toast`, not the field's `error` state — the decode fails
  before anything is attached, so there is no attachment to put an error in, and
  `AttachmentDescription` is `truncate`, which would cut the half of the message that says what to do
  instead. Decision 30._
- **A local `db reset` proves the policies exist, not that they will apply.** Docker was installed on
  2026-08-08, so the local stack is available and this plan uses it (decision 41) — but only so far.
  Locally `postgres` is effectively superuser, while on the hosted project `storage.objects` is owned by
  `supabase_storage_admin`. **A `create policy` that succeeds under `db reset` can still fail under
  `db:push`.** _Mitigation: treat the local check as catching a forgotten policy — the confusing failure
  above — and not as proof of applicability. Re-inspect with `npx supabase db query --linked` after
  pushing, plus a real upload and a signed-out fetch._
- **Storage is outside every drift check this project has, and the bucket is outside all of them.**
  `db:diff` excludes the `storage` schema by default, so the policies are not covered by the drift
  detection Docker just unlocked — and the bucket itself is a **row** in `storage.buckets`, data rather
  than schema, so no diff engine would see it whatever the scope. `No schema changes found` can print
  while the bucket is missing, public when it should not be, or wide open on MIME. CLAUDE.md's "never
  change structure in the dashboard" rule therefore carries more weight here than anywhere else in the
  project, with nothing behind it. _Mitigation: recorded in known-issues and in the rewritten
  image-storage.md, with a deliberate `db query` check rather than a diff. Decision 43._
- **Orphaned files accumulate.** Accepted; see decision 8 and the known-issues entry.
- **Unpublished recipes' photos are fetchable by URL** even though RLS hides the row. Accepted — uuids
  are unguessable — but it is a real divergence from how drafts behave everywhere else.
- **No upload progress percentage exists.** supabase-js `.upload()` is a `fetch` POST with no progress
  events; there is no `onUploadProgress` to reach for. The attachment shows an indeterminate shimmer.
  Worth knowing before an afternoon is spent looking for the callback.
- **The crop is destructive and one-shot.** No original is retained, so recropping means picking the
  file again. Accepted for a personal site, and it is why the ⟳ control is labelled as a replacement
  rather than an adjustment.
- **Eight step photos means eight crop dialogs.** One code path was chosen over a skip-the-crop
  shortcut, so that step photos and the cover cannot diverge (decision 15). If it grates in practice the
  fix is additive — a "Use as is" button beside "Use this crop", defaulting to a centre crop — and not a
  refactor.

## Milestones

Three, and each one ends with `npm run lint` and `npm run typecheck` green. Decision 40.

1. **Foundation** — the three migrations, `lib/supabase/storage.ts`, `upload.ts`. Nothing
   user-visible. Verified at the SQL level locally and then against the linked project.
2. **The wizard** — `CropDialog`, `ImageField`, the `draft.ts` and `RecipeWizard` changes, the three
   panels, **and `RecipeArticle` in the same milestone.** `PreviewRail` renders the real article
   (decision 12), so splitting it out would end a milestone with a preview that omits the photos just
   uploaded — the one thing that preview may not do.
3. **Public surfaces and docs** — `queries.ts`, the three type changes, `RecipeCard`, `next.config.ts`,
   and the doc rewrites.

## Verification

There is no test suite, so this is the whole of it. The first pass can now run before anything reaches
the real project; the other three are browser work and unchanged by Docker.

- **Storage policy pass.** `db reset`, then assert via `db query --local` that the bucket row exists
  with the intended public / size / MIME values and that all four policies are present and scoped to
  this bucket. Repeat against the linked project after `db:push` — see the risk above for why the local
  run is necessary but not sufficient. This is also what settles whether the `select` grant was needed.
- **Pipeline pass.** A portrait phone photo with EXIF rotation, end to end: the output must be upright
  _and_ correctly framed, since the wrong ordering yields rotated and offset rather than merely
  sideways. A HEIC file surfaces the toast. A non-webp blob is rejected by the bucket, proving the
  allowlist is live rather than assumed.
- **Concurrency pass.** Start an upload, then reorder and then delete that step before it lands — the
  `id` and `replaceById` path from decision 31. Replace a photo while another upload is in flight.
  Click Publish mid-upload and confirm it is blocked.
- **Lifecycle pass.** Delete a recipe with a cover and step photos: rows gone by cascade, files gone by
  the explicit remove, and a simulated storage failure still reporting success. Abandon a wizard after
  uploading and confirm the orphan exists — decision 8's accepted cost, worth seeing once.

## Open questions

- **The sweep's 24-hour age floor is a guess.** It only needs to exceed the longest plausible wizard
  session.
- **Whether `slider.tsx` is worth pulling in** for the crop dialog's zoom, or whether wheel and pinch
  plus a bare range input is enough for a control the owner uses a handful of times a week.

_Two entries were closed by the 2026-08-08 grill and are recorded here so they are not reopened: the
path convention now has a single source (decision 44), and `getRecipes()` joins images with a narrow
primary-filtered embed rather than denormalising (decision 36)._

## Assets

- [assets/crop-prototype.html](assets/crop-prototype.html) — a **working** 1:1 crop picker: real
  pointer-drag, wheel and slider zoom, cover-clamping, live `{ sx, sy, size }`, and the output square
  drawn by the same `drawImage` the pipeline makes. Loads your own photos. This is what "the dialog is
  ~150 lines" is measured against, and the maths is portable to React as-is.
- [assets/image-ui-decisions.html](assets/image-ui-decisions.html) — the A–H comparison sheet. Its live
  parts are the reasoning behind decisions 18 and 21: a simulator that reorders and deletes steps
  against five candidate state models, and a rail that runs `PreviewRail`'s real scroll maths and then
  lands a cover to show the drift.
- [assets/image-ui-remaining.html](assets/image-ui-remaining.html) — the last eight calls, drawn at
  true 768px scale. The page-height readouts under decision 22's options and the mixed-grid toggle
  under decision 23 are the numbers those two decisions rest on.
