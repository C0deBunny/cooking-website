# Decisions: Recipe images

## 1. One image per step plus one cover, not a gallery

- **Date:** 2026-08-06
- **Considered:** step images only · step images plus a single cover · step images plus the full
  gallery `recipe_images` was designed for (many rows, `sort_order`, one primary)
- **Chosen:** step images plus one cover. Step images alone would have been the smallest possible
  slice — `save_recipe()` already writes `recipe_steps.image_path`, so it needs no SQL at all — but the
  public site would gain nothing visible from the work: `RecipeCard` and `/recipes` would stay
  imageless. A cover is what those two surfaces need, and it costs one new key on the payload.
- **Why not the gallery:** its payoff is entirely in detail-page display, which is explicitly out of
  scope here, and it drags in reorder UI and a primary picker for a personal site that has never had a
  single photo on it.
- **Trade-off:** `recipe_images` gets used at a fraction of its design. Mitigated by shaping the
  payload key as a **list** rather than a single object, so adding a gallery later is a UI change and
  not a payload change.

## 2. Create-only, but shaped so editing is wiring rather than a rewrite

- **Date:** 2026-08-06
- **Considered:** create-only in the simplest possible form, assuming every image is brand new ·
  create-only, but with a draft shape an edit could hydrate into · create and edit together, including
  deleting the file behind a replaced image
- **Chosen:** create-only with the forward-compatible draft shape. `RecipeWizard`'s own comment already
  states that editing will reuse the wizard, and holding `image_path: string | null` costs nothing
  today while being exactly what a saved recipe hydrates into.
- **Why not both at once:** `save_recipe()` replaces `recipe_images` wholesale, so a _replaced_ cover
  leaves its old file behind — and app code would have to have read the old path before the write to
  clean it up. That is a second orphan class with its own ordering problem, and it doubles the surface
  of a feature that has not shipped once yet.
- **Trade-off:** editing a recipe's images will orphan the replaced files until the sweep in decision 8
  exists. Recorded in the known-issues entry as one of its three sources.

## 3. Compress client-side to webp before uploading

- **Date:** 2026-08-06
- **Considered:** canvas-resize to ~1600px and re-encode to webp in the browser · upload the original
  with a hard size cap and reject anything larger · upload the original with no cap beyond the bucket
  default
- **Chosen:** compress in the browser. A phone photo is 4–12MB and Supabase's image transformation is
  Pro-plan only, so on the free tier whatever is uploaded is what is stored and fetched. `next/image`
  resizes at render, but the origin fetch still pulls the full file, and both storage and egress are
  metered. ~9MB becomes ~200KB.
- **Why not a size cap:** it makes the owner's own phone camera the thing that gets rejected, with no
  way to fix it inside the app.
- **Trade-off:** the stored file is not byte-identical to what was picked, and the pipeline has to be
  built and its EXIF and HEIC edges handled. It also, usefully, sidesteps Vercel's 4.5MB server-action
  body limit outright — a photo would clear that cap on a server-side upload path.

## 4. Upload eagerly on file-pick, not deferred to submit

- **Date:** 2026-08-06
- **Considered:** **(A)** upload the moment a file is picked, to a path containing no `recipe_id` ·
  **(B)** hold the `File` in memory and upload after the recipe is saved, so paths can be keyed by
  `recipe_id` · **(C)** upload eagerly into `drafts/<session>/` and move the files into
  `recipes/<recipe_id>/` during save
- **Chosen:** A. No `recipe_id` exists while the wizard is running, because a recipe cannot be saved in
  pieces, so the `recipes/<recipe_id>/<uuid>` path that `image-storage.md` suggested is unbuildable at
  pick time. Uploading eagerly means the draft holds a **path**, which is precisely the field
  `save_recipe()` reads — `toPayload()` passes it straight through, and the submit stays one JSON blob
  and one transaction.
- **Why this is not just convenience:** it is what preserves the wizard's central invariant. B forces
  the draft to hold a `File` that `toPayload()` cannot resolve into a path, so each step's ✓ would be
  parsing an object materially different from the one actually submitted — the exact drift decision 2
  of the wizard plan exists to prevent.
- **Why not B on its own merits:** it turns one atomic write into three independently-failing phases
  (save → upload → write paths back), which is the specific hazard `save_recipe()` was written as a
  single function to eliminate. And it does not deliver the tidiness it promises: if the uploads land
  and the path write-back fails, files are orphaned exactly as in A. **It relocates the problem rather
  than solving it.** It also makes the Publish click hang for several seconds while ten photos upload.
- **Why not C:** most machinery for the least gain — a move step with its own partial-failure case,
  payload paths that are not the final paths and so must be rewritten mid-save, and a whole second
  class of garbage (`drafts/`) needing its own sweep on top of the one it was meant to avoid.
- **Trade-off:** abandoning the wizard after uploading leaves files nothing references. Narrowed by
  deleting a file immediately on ✕, since its path is known; see decision 8 for the remainder.

## 5. Flat `recipes/<uuid>.webp` paths, no per-recipe folder

- **Date:** 2026-08-06
- **Considered:** `recipes/<recipe_id>/<uuid>.webp` as `image-storage.md` suggested · flat
  `recipes/<uuid>.webp` · a date-prefixed variant
- **Chosen:** flat. Forced in part by decision 4 — there is no id to fold into the path — but it costs
  nothing real. The per-recipe folder existed so that deleting a recipe could wipe a prefix, and that
  was never going to work anyway: the rows are the only record of which files belong to what, so
  deletion has to read `storage_path` and `image_path` off them regardless.
- **Why flat rather than date-prefixed:** a prefix that carries meaning can become wrong. If a cover
  later becomes a promoted step photo, a `steps/` or `covers/` split would lie about the file. A uuid
  claims nothing.
- **Trade-off:** one growing prefix rather than a browsable tree, and eyeballing the bucket in the
  dashboard tells you nothing about which recipe a file belongs to. Prefixes are virtual in object
  storage, so there is no performance cost.

## 6. A public bucket, accepting that draft photos are URL-reachable

- **Date:** 2026-08-06
- **Considered:** a public bucket with plain object URLs · a private bucket with signed URLs generated
  per render
- **Chosen:** public. It buys URLs that `next/image` and the CDN can both cache, with no signing, no
  expiry logic and no request-time work anywhere. A personal recipe site is public content.
- **Trade-off, and it is a real one:** an **unpublished** recipe's photos are fetchable by anyone
  holding the URL, even though RLS hides the recipe row. Uuids are unguessable so the practical risk is
  nil, but this is a genuine divergence from how drafts behave everywhere else in the app, and it is
  accepted deliberately rather than discovered later.

## 7. `image/webp` only on the bucket, as defence in depth

- **Date:** 2026-08-06
- **Considered:** allowlist jpeg, png and webp · allowlist webp alone · no MIME restriction, size cap
  only
- **Chosen:** webp alone, with a `file_size_limit` around 2MB. Everything leaving the browser is
  already webp under decision 3, so the bucket physically rejects anything that bypassed the
  compression pipeline. Nothing else enforces that pipeline — it is a convention in one client-side
  file — so this is the only mechanical guard on it.
- **Trade-off:** if the pipeline ever needs a fallback path for a format the canvas cannot decode, the
  allowlist has to widen with it, and forgetting that turns into an opaque upload rejection. Tied
  directly to the HEIC risk in the plan.

## 8. Accept orphaned files; record the sweep as a future admin feature

- **Date:** 2026-08-06
- **Considered:** accept orphans and log the gap · build a `beforeunload`-time cleanup · build an
  admin-side "unused files" sweep now as part of this work
- **Chosen:** accept and record. Decision 4 already established that the alternatives to eager upload
  relocate orphans rather than remove them, so this is debt the approach was chosen with open eyes.
  Deleting on ✕ narrows the leak to closing the tab, which for a single-owner site is a handful of
  files a year.
- **Why not `beforeunload`:** it is unreliable by design, browsers do not guarantee the request lands,
  and it would fire on a deliberate refresh too — deleting files from a session the user was about to
  resume.
- **Chosen future shape:** an admin page button that lists the bucket, diffs against
  `recipe_images.storage_path ∪ recipe_steps.image_path`, and deletes what nothing references —
  **restricted to objects older than roughly 24 hours.** A file uploaded thirty seconds ago by a wizard
  that is still open is unreferenced but _not_ orphaned, and a naive diff would delete a photo out from
  under a live editing session. That constraint is the reason to write the entry now rather than when
  the feature is picked up.
- **Trade-off:** the bucket accumulates junk until that feature exists, and nothing surfaces how much.

## 9. One `ImageField` component serving both placements

- **Date:** 2026-08-06
- **Considered:** a shared component parameterised by size and label · separate `CoverImage` and
  `StepImage` components
- **Chosen:** one. A step photo and a cover photo are the same interaction — pick one image, watch it
  upload, see it, remove it — and every difference between them is presentational.
- **Why not two:** they drift. One would get the EXIF fix, the retry button or the `type="button"`
  guard and the other would not, and the divergence would be invisible until a bug appeared in exactly
  one of the two places.
- **Trade-off:** the component takes presentation props it would not otherwise need. Small, and it
  keeps the wrapper thin enough that `attachment.tsx` is still doing the actual work.

## 10. In-flight uploads block the submit, not the ✓

- **Date:** 2026-08-06
- **Considered:** fold "no upload in flight" into the per-step `complete[]` marks · leave the ✓ alone
  and disable the Publish button · block the Next button while any upload is running
- **Chosen:** block the submit. Clicking Publish mid-upload would save `null` where a photo was about
  to be, so something has to hold it — but each ✓ is that step's own `safeParse` and nothing else, and
  an upload in flight is an asynchronous fact about the world, not a property of the data's shape.
  Folding it in would make the tick flicker on a network operation.
- **Precedent, not a new mechanism:** this is exactly the reasoning already written down for
  `slugTaken` at `RecipeWizard.tsx:72-84`, and it lands in the same place — the button, not the tick.
- **Why not blocking Next:** it stalls the wizard on a network operation nobody asked to wait for, and
  it does not solve the underlying problem, only hides it.
- **Trade-off:** panels unmount on step change, so a failure that happens after leaving the panel has
  nowhere to render. Handled by lifting the per-field **error** to the wizard alongside the busy set,
  and reporting it in the Review checklist — otherwise the user sits on Review with a disabled button
  and no explanation.

## 11. Delete rows before files, and never fail a delete on a storage error

- **Date:** 2026-08-06
- **Considered:** remove the files first, then the row · read the paths, delete the row, then remove
  the files best-effort · wrap both so a storage failure fails the whole delete
- **Chosen:** read paths → delete row → best-effort remove. Reading first is forced: cascade takes
  `recipe_images` and `recipe_steps` with the recipe, and with them the only record of which files
  belonged to it.
- **Why rows before files:** it fixes which way a half-failure falls. Rows-first leaves _files
  orphaned, rows gone_ — harmless, and precisely what decision 8's sweep exists to collect.
  Files-first risks _files gone, rows still referencing them_, which is a live recipe rendering broken
  images at visitors. **Every failure should fall toward wasted bytes, never toward a broken
  reference** — the same rule that governs the ✕ clearing the draft field even when `.remove()` fails.
- **Why a storage failure must not surface as an error:** the recipe genuinely was deleted, so
  reporting "failed to delete the recipe" would be false.
- **Trade-off:** silent orphaning on a storage failure, with no signal to the operator. Third source
  listed in the known-issues entry.

## 12. `RecipeArticle` renders images minimally, so the preview stays honest

- **Date:** 2026-08-06
- **Considered:** give `RecipeArticle` the minimum rendering — cover on top, step photos under their
  instructions · leave the article untouched and show thumbnails only in `PreviewRail` · render images
  nowhere for now
- **Chosen:** minimal rendering in the article. Detail-page display was explicitly out of scope, but
  the wizard's live preview _is_ `RecipeArticle` — decision 15 of the wizard plan deliberately renders
  the real component rather than a lookalike. So images in the draft force the question either way: the
  alternative is a preview that omits the photos you just uploaded, which is a preview that lies about
  what you are publishing.
- **Why not thumbnails in `PreviewRail`:** it would make the preview a lookalike renderer, which is the
  exact drift decision 15 exists to prevent.
- **Why not nothing:** the feature would be unobservable outside the storage dashboard.
- **Trade-off:** a small amount of detail-page work lands inside a plan that declared it out of scope.
  Bounded deliberately to plain `next/image` with no layout design — making it look good stays a
  separate job.
