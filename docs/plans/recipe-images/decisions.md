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
- **Extended by 13 and 14:** the same pipeline also crops, to a square the user chooses. The resize and
  re-encode described here are unchanged; one `drawImage` gains a source rectangle.

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
- **Both halves depend on decision 33.** The ✕ that narrows the leak is a `.remove()`, and the sweep is
  a `.list()`; neither works on `delete`/`insert` policies alone. Without the `select` grant this
  decision's central claim — that the leak is only "closed the tab" — would have been false and nothing
  would have said so.

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
  nowhere to render.
- **Mechanism superseded by 18.** The conclusion stands unchanged — an upload in flight blocks the
  submit and never the ✓. But the lifted busy `Set` and per-field error `Map` described here are
  replaced by a union field on the row, from which both are derived. The reason is a failure this
  decision did not anticipate: lifted collections survive the deletion of the step they describe.
  Reporting through Review is also superseded, by 25 — it goes in the existing alert block rather than
  the checklist.

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
- **The removal step needs decision 33's `select` grant.** `.remove()` reads the rows it deletes, so on
  write policies alone this step could remove nothing and — by design, since a storage failure must
  stay silent here — report success either way.

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
- **Bound superseded by 20, 21 and 22.** "Plain `next/image` with no layout design" was tenable while
  the aspect ratio was undecided. Once every image is a square, the article has to answer how wide the
  cover goes, what an empty one looks like, and how big a step photo is — a 1:1 photo at full column
  width is a specific and bad choice, not a neutral default. Making the page _look good_ is still a
  separate job; these three only pin down what it cannot avoid deciding.

---

The decisions below settle the UI, worked out against the three mockups in `assets/`. Numbers 1–12
above were the write path and the storage model; these are the surface. Nothing above is reversed
except where a supersession note says so.

## 13. Crop in the browser, to a square the user positions

- **Date:** 2026-08-06
- **Considered:** no crop, store the photo at its own aspect and let each surface `object-cover` it ·
  no crop plus a warning when the source is far off ratio · a crop dialog where the user drags and
  zooms a fixed-ratio window before upload
- **Chosen:** the crop dialog. The deciding argument is what it _deletes_: because the stored file is
  already the final framing, every surface renders it 1:1 and nothing crops it again — so the aspect
  check, the "this will be cropped" warning, and the entire question of which surface frames a photo how
  all disappear. Decision 12's rule that the preview must not lie stops being mitigated and becomes
  true by construction.
- **Why it is cheap:** the pipeline already calls `drawImage`; a crop is the same call in its 9-argument
  source-rect form. Nothing about compression, webp, the bucket, the payload, `save_recipe()` or the
  path convention changes. The dialog is ~150 lines with no dependencies — there is no cropper in the
  shadcn registry, so the alternative would have been a real third-party package.
- **Trade-off:** the crop is destructive and one-shot, since no original is kept — "a bit higher" means
  picking the file again. And the EXIF hazard gets sharper rather than going away: crop against an
  `<img>` (which auto-applies rotation) and draw against a bitmap (which does not) and the output is
  rotated _and_ offset. Mitigated by an ordering rule, not by care.

## 14. 1:1, not 16:9 or 3:2

- **Date:** 2026-08-06
- **Considered:** 16:9 · 3:2 · 4:3 · 1:1
- **Chosen:** 1:1. Centre-crop loss from a 3:4 phone photo decided it: 16:9 discards **58%** of the
  height, 3:2 discards 50%, 4:3 discards 44%, and 1:1 discards 25%. Recipes here are shot on a phone,
  usually portrait, so the common case is the one the wide ratios punish hardest. A square is also the
  only ratio that behaves identically in a card grid and in a 19rem preview rail, so the preview stays
  honest with no per-surface reasoning.
- **Why not wider now that the user crops anyway:** the user chooses _what_ is in the frame, not the
  frame's shape. A wide frame still forces them to throw away most of a portrait photo.
- **Trade-off:** a square is a weaker hero shape than a banner, which is what forces decision 20 —
  a full-bleed square would be as tall as the viewport is wide.

## 15. Step photos get the same field, the same cropper and the same square

- **Date:** 2026-08-06
- **Considered:** cover only gets the cropper, step photos upload at their own aspect · both get it ·
  both get it with a "Use as is" escape hatch
- **Chosen:** both, strictly. Decision 9 already established one `ImageField` for both placements
  because every difference between them is presentational; two crop paths would be the same drift
  hazard one level down. Square step photos also make the article's method section predictable, which
  decision 22 depends on.
- **Trade-off, and it is real:** a recipe with eight step photos means eight crop dialogs, each needing
  a drag and a confirm. Accepted because the fix is additive — a "Use as is" button doing a centre crop
  — and not a refactor, so it can wait until the friction is felt rather than predicted.

## 16. A capped horizontal attachment, not a vertical square

- **Date:** 2026-08-06
- **Considered:** `attachment.tsx`'s vertical variant as a small square below the note · the vertical
  variant beside the step number · the horizontal variant at full column width · the horizontal variant
  capped at ~18–20rem with a larger thumbnail
- **Chosen:** capped horizontal, media bumped up from `w-10`. Full width is wrong by measurement: the
  wizard's panel column is roughly 700px, so a full-width bar is about 94% chrome around a 40px
  thumbnail.
- **Why not the vertical variant at all:** `orientation="vertical"` is `w-24` but
  `has-data-[slot=attachment-content]:w-30`, so the field jumps 96→120px the moment an error message
  needs `AttachmentDescription` — the row shoves sideways exactly when something has gone wrong. It is
  also the only orientation with no room for a label or a full message.
- **Trade-off:** the horizontal form is the tallest of the options, and it needed an override to
  `attachment.tsx`'s media size rather than using the variant as shipped.

## 17. The step photo field collapses to a text button until used

- **Date:** 2026-08-06
- **Considered:** the dashed attachment bar always visible on every step row · a quiet `＋ photo` text
  button that expands into the bar once a file exists
- **Chosen:** collapsed. On a ten-step recipe the always-visible version turns the Method panel into
  mostly empty photo slots, and the instructions stop being the obvious thing to fill in. Collapsed
  also means the rows that _do_ have a photo are the only ones with a thumbnail, which reads as
  information rather than as chrome.
- **Trade-off:** less discoverable, and it gives `ImageField` a second idle presentation — which is
  precisely the divergence decision 9 warns about. Bounded by keeping it to the _idle_ branch only:
  every other state renders identically in both placements.

## 18. One union field on the row; busy and failed are derived

- **Date:** 2026-08-06
- **Considered:** a busy `Set` and error `Map` lifted to `RecipeWizard`, keyed by array index (as
  decision 10 originally described) · the same, keyed by a new stable `id` on `StepDraft` · the same
  plus disabling the row's ↑ ↓ ✕ while an upload is in flight · three transient fields on the row
  (`image_path`, `uploading`, `error`) · **one** union field on the row, with everything derived · the
  field owning its state locally and reporting only an in-flight count
- **Chosen:** one union field: `null | {status:"busy"} | {status:"done";path} | {status:"failed";reason}`.
- **Why, and it is a failure none of the alternatives survive:** lifted collections outlive the row they
  describe. Delete a step whose upload _failed_ and the error entry stays, so Review reports a failure
  for a step that no longer exists and Publish stays blocked with no reachable cause. Index keys desync
  on reorder as well; a stable `id` fixes that but not this, since `filter()` does not clean the `Map`
  either. Disabling the row controls only covers _busy_ rows — a failed row is not busy, so it stays
  deletable.
- **Two further reasons:** the union makes "has a path _and_ an error" unrepresentable, which three
  separate fields permit; and it needs **no new `useState` in `RecipeWizard` at all**, matching how
  `payload`, `preview`, `complete` and `missing` are already derived there.
- **Why not local state in the field:** a failure landing after the panel unmounts has nowhere to
  render, the in-flight count decrements, Publish re-enables, and the recipe saves without that photo —
  silently. The worst failure mode of the six for the least code.
- **Trade-off:** `toPayload()` stops being a literal pass-through for this one field, which weakens the
  wording of decision 4 — though not its substance: the draft still holds a path and never a `File`,
  the submit is still one blob and one transaction, and the ✓ still parses the payload.
- **Amended by 31, which dismissed the stable `id` against the wrong criterion.** The reasoning above
  is right that an id does not clean up a lifted `Map` — but that judged the id on _state ownership_,
  which the union solves, and not on _write-back targeting_, which it does not. The completion still
  has to find its row seconds later through a positional `replaceAt`. Decision 31 adds the id for that
  second job; everything this decision concludes about where the state lives stands unchanged.

## 19. The cover field sits beside the text fields, not above or below them

- **Date:** 2026-08-06
- **Considered:** above the title · after the description, before the difficulty/times grid · in a
  second column to the right of the title and description
- **Chosen:** the right-hand column, spanning both rows. It costs no vertical space at all, filling room
  the title and description already occupy, and it reads as recipe-level metadata sitting beside the
  recipe-level text.
- **Why not above:** it puts an optional field ahead of the only required one, so the first thing you
  meet on a blank recipe is a photo picker rather than the title.
- **Why not below the description:** a square field there pushes difficulty and both times off a laptop
  screen, so a step that used to fit now needs a scroll.
- **Trade-off:** needs a stacking rule below roughly 640px, which `DetailsPanel` does not have today.

## 20. An overlaid square hero at column width, not full-bleed

- **Date:** 2026-08-06
- **Considered:** the cover inside the tinted band beneath the title · full-bleed above the band ·
  overlaid on a full-bleed photo · overlaid on a square capped at the reading column · overlaid
  full-bleed with the square letterboxed on a blurred fill · overlaid, edge-to-edge on mobile and
  capped above
- **Chosen:** overlaid on a 1:1 square capped at `max-w-3xl` and centred.
- **Why not genuinely full-bleed:** a square that wide is that tall. At a 1400px viewport the hero
  would be 1400px before the title, putting everything else permanently below the fold — and the
  obvious bound, `max-h` plus `object-cover`, re-crops the square the user just framed and hands back
  the warning decision 13 deleted.
- **Why this over the blurred letterbox:** the letterbox keeps real edge-to-edge width with nothing
  cropped, but costs a second `<img>` of the same file plus a blur layer, and collapses back to this
  on a narrow screen anyway. Column-bleed needs no new layout rule at all, since the article is already
  `max-w-3xl` throughout, and is identical at every width — so the rail and the page agree with no
  breakpoint.
- **Trade-off:** on a wide screen the hero is an island with tinted space either side. It reads as a
  magazine opener rather than a banner, which is less dramatic than "full-bleed" suggests.

## 21. Reserve the square only while `placeholders` is on

- **Date:** 2026-08-06
- **Considered:** always reserve an empty dashed square · fall back to today's tinted band whenever
  there is no cover · reserve in the wizard, band on a published page
- **Chosen:** the third. It is what the `placeholders` prop already exists to express, and its own
  comment draws this exact distinction: a draft being typed has a cover that isn't chosen yet, and a
  published recipe with no cover simply has none.
- **The reason it matters is a layout shift.** The cover field is on Details, but an upload still in
  flight when Next is pressed lands while the user is on Ingredients — and `PreviewRail`'s scroll effect
  depends only on `[step]`. A square appearing where nothing was moves the article underneath a scroll
  position computed without it, leaving the user looking at the wrong part of their own recipe.
  Reserving the space makes that **unreachable** rather than handled; the alternatives are correct only
  if `recipe.cover` is added to the effect's deps.
- **Why not always reserving:** a published recipe with no cover would show visitors an empty dashed
  box — a gap announced to someone who cannot fill it.
- **Trade-off:** two header layouts still exist in `RecipeArticle`, which was D3's known cost. Bounded
  by putting the fork on the `placeholders` line, which already exists, rather than on a new one.

## 22. Step photos render at roughly 300px, not full column width

- **Date:** 2026-08-06
- **Considered:** full column width (768px square) · roughly 40% of the column (~300px) · a 120px
  inline thumbnail beside the instruction
- **Chosen:** ~300px, beneath the instruction and indented to the text column. The deciding number is
  page height: at six steps, full-column runs to roughly nine screens, ~300px to about four, and inline
  thumbnails to about two and a half. Full column means **one step per screen**, and a method that has
  to be scrolled a screen at a time stops reading as a sequence.
- **Why not the 120px thumbnail:** it is a reference image rather than a photograph. Having just made
  the owner crop every photo deliberately, showing the result at 120px wastes the work.
- **Trade-off:** a genuinely good photo is shown smaller than it deserves. One value, no responsive
  rule, and it degrades sanely at twelve steps — which the full-column option does not.

## 23. A generated tile for a recipe with no cover

- **Date:** 2026-08-06
- **Considered:** a neutral dashed placeholder tile · no media at all, so the card is simply shorter ·
  a tile tinted from the slug carrying the title's first letter
- **Chosen:** the generated tile. **Every existing recipe has no cover**, so a mixed grid is the state
  of the site the day this ships rather than an edge case worth deferring. A dashed placeholder
  announces a gap to visitors repeatedly across the grid; omitting the media leaves it ragged for as
  long as the library is mixed. The tile keeps the grid tidy and looks intentional.
- **Trade-off:** it invents a visual idiom for a state that should shrink over time, and needs a colour
  derivation nobody asked for. Accepted because `RecipeCard` has no media area at all today
  (`{ title, description }`), so its signature is changing regardless.
- **Amended 2026-08-08: the state does not shrink over time.** There is no edit path — `app/admin/`
  holds create, manage, preview and tags, and the only write actions are `saveRecipe`,
  `togglePublished` and `deleteRecipe` — so the six existing recipes cannot receive a cover without
  being deleted and retyped. The tile is the permanent look for pre-image recipes until an edit path
  exists, which no non-goal in this plan provides. Accepted as-is: a cover-only edit affordance would
  reverse a non-goal, and retyping six recipes risks changing live URLs.

## 24. Replace uploads the new file before it removes the old one

- **Date:** 2026-08-06
- **Considered:** no replace control — ✕ then pick again · remove the old file, then upload the new one ·
  upload the new one, then remove the old best-effort, then hand back the new path · the same, plus
  storing the last crop rectangle so a recrop reopens where you left it
- **Chosen:** upload → remove → set path. The order is the whole decision: if the new upload fails, the
  original photo and its path are untouched, so the user still has their photo. Remove-first loses it —
  the old file is gone and the draft holds a path to nothing, which is a broken reference on a live
  save.
- **This is decision 11's rule one level down:** every failure should fall toward wasted bytes and never
  toward a broken reference. A failed remove here costs one orphan, which is what the sweep exists for.
- **Why a replace control at all:** the crop is destructive, so "recrop" _is_ "replace". Requiring ✕
  first means the commonest correction has a window where the photo is gone for good.
- **Why not remember the crop rectangle:** it is only meaningful for the same photo, and a different
  photo has different dimensions, so it needs clamping or it throws — for a saving of one drag.

## 25. Upload failures reuse the existing alert block

- **Date:** 2026-08-06
- **Considered:** the `role="alert"` box that already carries `state.error` and the slug collision · a
  fourth "Photos" row in the Review checklist with its own state · both
- **Chosen:** the existing alert block, with a "Back to Method" button mirroring the existing "Back to
  Details". No new UI vocabulary, and it lands where a blocking problem plus a way back already lives.
- **The checklist stays untouched, and that is the point:** its green `Check` remains a constant because
  each step's ✓ genuinely parses. The step _is_ complete; only its photo failed. Giving the checklist
  per-row state would blur what a tick means.
- **Trade-off:** photos are invisible in the summary when everything worked, so there is no glance-level
  confirmation that four photos are about to be published. Both messages must route through one helper,
  as `slugTakenMessage` already does, or the wording drifts.

## 26. A step with a photo but no instruction stays in the preview

- **Date:** 2026-08-06
- **Considered:** leave `toPreview()`'s filter alone · keep a step if it has an instruction _or_ a
  finished photo · keep every step whenever `placeholders` is on
- **Chosen:** instruction _or_ photo, with `No instruction yet.` rendered beneath the photo in
  `PLACEHOLDER_TEXT`. The natural order of work is add step → attach photo → type, and the current
  filter shows no trace of a photo that is genuinely in the draft and genuinely about to be saved.
  A preview that omits what is about to be published is the one thing a preview must not do.
- **Why not keep every step:** `EMPTY_DRAFT` starts with one empty step, so the preview would open with
  a placeholder row before anything at all has been typed.
- **Trade-off:** panel row numbers and article step numbers still diverge when a blank row sits
  mid-list, so "Step 3" remains mildly ambiguous about which numbering it means.

## 27. Drop `recipe_images.alt` rather than carry it unused

- **Date:** 2026-08-06
- **Considered:** keep the column and always send `null`, with the entry point as an open question · add
  an alt input beside the cover field · ask for alt text once on the Review panel · drop the column, the
  schema field and the payload key
- **Chosen:** drop it. `next/image` requires an `alt` prop regardless, so this is not a decision about
  whether alternative text exists in the HTML — only about whether it is stored per row or decided in
  the component.
- **And `alt=""` is the correct value here, not a compromise.** Under decision 20 the title is overlaid
  _on_ the cover, and a step photo sits directly beneath the instruction describing it, so in both
  cases the accessible name is already adjacent and a duplicate would be noise. The dropped column's own
  comment made this argument before any of this existed: "Nullable, because a purely decorative image
  should have empty alt rather than invented alt."
- **Why not keep it for later:** a nullable column nothing writes is a claim the schema makes and the
  app does not honour, and re-adding it is one additive migration if a caption feature ever wants it.
- **Trade-off:** a destructive migration, which needs its own `raise exception` gate per
  `docs/database-workflow.md`. Cheap here — nothing has ever written the column — and the precedent to
  copy is `20260801190718_remove_ingredient_groups.sql`.

## 28. No phone support, stated rather than inherited

- **Date:** 2026-08-06
- **Considered:** leave it as it is and let the wizard render however it renders below 1024px · show an
  explicit "open this on a computer" panel · make the wizard responsive
- **Chosen:** leave it, and record the choice. `/admin` is deliberately desktop-first — `AdminSidebar`
  is `collapsible="none"` with a fixed 16rem rail, and `PreviewRail` is hidden below 1024px — and making
  the wizard responsive means changing the admin shell, which belongs to `/admin` as a whole rather than
  to this plan.
- **The tension, recorded because it is genuine:** decision 3 chose browser-side compression
  specifically because "a phone photo is 4–12MB", and the crop dialog uses pointer events specifically
  so touch works. Both assume a phone. The route they run on does not, so adding a photo means getting
  it onto a desktop first.
- **Why not the explicit message either:** its only useful second sentence is a promise about editing
  from a phone, which does not exist. Without that it simply says no, which the cramped layout already
  communicates.
- **Trade-off:** a 390px screen gets horizontal scrolling with no explanation. Written into
  `docs/known-issues.md` so the mismatch is findable rather than rediscovered.

## 29. `Dialog`, and Cancel keeps nothing

- **Date:** 2026-08-06
- **Considered:** `Dialog` · `Sheet` · Cancel returns the field to `idle` · Cancel retains the picked
  `File` so reopening the cropper skips re-picking
- **Chosen:** `Dialog`, Cancel → `idle`. A square viewport wants a squarish container, and a centred
  modal gives it the most room on a desktop — which, per decision 28, is the only place this runs. A
  `Sheet` would be a mobile idiom on a desktop-only route.
- **Why Cancel keeps nothing:** retaining the `File` means a fourth field state holding something
  `toPayload()` cannot resolve into a path — the exact shape decision 4 rejected — and the union in
  decision 18 has no `status` for it. The cost is one extra click on a rare action.
- **Trade-off:** on a phone a centred modal with a drag surface would fight the browser chrome. Moot
  while decision 28 stands, and the reason to revisit this if it ever does not.

## 30. Decode failures surface as a toast, not as the field's error state

- **Date:** 2026-08-06
- **Considered:** force `ImageField` into `error` with a retry · a `sonner` toast
- **Chosen:** a toast. `createImageBitmap` throws **before** anything is attached, so an `error` state
  would describe a photo that was never accepted — and it would have to be dismissed by a ✕ with no
  file to delete. `Toaster` is already mounted in `app/admin/layout.tsx` and `toast` is how admin
  mutations already report failure, so this adds no new pattern.
- **A concrete constraint decided it:** `AttachmentDescription` is `truncate`, so the inline version
  physically cannot fit the useful half of the message — "HEIC isn't supported, save it as JPEG first,
  or share from Photos rather than Files" is the actionable part and it is the part that gets cut.
- **Trade-off:** a toast is transient, so dismissing it or looking away loses the explanation with no
  way back to it. The field stays honestly idle, which is at least not misleading.

---

The decisions below came out of grilling the plan's non-UI half on 2026-08-08, after the UI was
settled. Several correct statements made above; each says so. Docker Desktop was installed the same
day, which is what 41–43 respond to.

## 31. A stable `id` on `StepDraft`, and factories instead of shared empties

- **Date:** 2026-08-08
- **Considered:** keep index-based writes and disable ↑ ↓ ✕ while an upload is in flight · abort every
  in-flight upload on any row mutation · give `StepDraft` a stable `id` and write back by it
- **Chosen:** the stable `id`, with a `replaceById` helper beside the existing `replaceAt`.
- **The failure it fixes is not the one decision 18 was judged against.** 18 put the state on the row
  so that deleting a row takes its state with it — correct, and unchanged. But the _write-back_ still
  has to find that row seconds later, and the only mutation primitive is
  `replaceAt(items, index, patch)`, which is positional. Start an upload on step 3, click ↑ on step 4,
  and the finished path lands on the wrong step while the genuinely busy one stays `{status:"busy"}`
  forever — `uploading` never clears, Publish is disabled permanently, and nothing on screen says why.
  Delete the row instead and the write is a silent no-op against a shifted array.
- **Why not disabling the row controls:** 18 already dismissed it, and for a reason that still holds —
  it covers _busy_ rows only, and a **failed** row is not busy, so it stays freely reorderable.
- **Why not aborting on mutation:** it costs the user an unrelated upload for an unrelated edit, and
  orphans the bytes already sent.
- **Consequence, and it is mechanical:** `EMPTY_STEP` and `EMPTY_DRAFT` can no longer be shared
  constants, because `{ ...EMPTY_STEP }` would clone one id onto every row. They become `newStep()`
  and `emptyDraft()`, and `RecipeWizard` uses the lazy form `useState(() => emptyDraft())`.
- **The id never leaves the client.** `toPayload()` maps step fields explicitly, so it cannot leak into
  the payload; SSR and hydration generating different ids is harmless because it never reaches the DOM.
  On the edit path later, the real `recipe_steps.id` hydrates into the same field.
- **Trade-off:** one more field on the draft, and a second mutation helper that has to be reached for
  in the right places. Offset by fixing React's row keys at the same time, which are positional today.

## 32. The blob's own `type` is what the bucket checks, and files cache for a year

- **Date:** 2026-08-08
- **Considered:** pass `contentType: "image/webp"` to `.upload()` and rely on it · rely on the blob's
  own type and document that · widen the bucket allowlist so the question stops mattering
- **Chosen:** rely on the blob's type, and comment it where it is set. Verified in
  `@supabase/storage-js`: for a `Blob` body the client wraps it in `FormData` and **never sets a
  content-type header at all**, so the `contentType` option is silently ignored and the MIME the bucket
  checks comes from the multipart part — that is, from `blob.type`.
- **Why it needs writing down:** it makes `convertToBlob({ type: "image/webp" })` load-bearing on the
  _bucket policy_ rather than merely on file size. Drop the argument, or switch to `canvas.toBlob`
  with a typo, and the blob is `image/png`, the bucket rejects it with an opaque 400, and it reads
  exactly like the missing-policy failure decision 7's allowlist was supposed to be defence against.
  Adding `contentType` "to be safe" is worse than useless — it looks like a guard and is a no-op.
- **Why not widen the allowlist:** it reverses decision 7, removing the only mechanical guard on the
  compression pipeline to fix a problem a comment fixes.
- **`cacheControl: "31536000"` rather than the library's `"3600"` default.** Paths are uuids and a
  replace mints a new one (decision 24), so the object at a given path is immutable. An hour is not the
  CDN caching decision 6 chose a public bucket to get.
- **Trade-off:** a year is unrecoverable if a file is ever overwritten in place, which nothing in this
  design does — but "nothing does" is a property of the code, not of the bucket.

## 33. Grant `select` on `storage.objects` alongside the writes

- **Date:** 2026-08-08
- **Considered:** insert/update/delete only, as the plan first had it · add `select` now · add `select`
  later, with the sweep that needs it
- **Chosen:** grant `select` too, to `authenticated`, in the same migration.
- **The plan's "read needs no `select` policy" was true about the wrong thing.** The bucket being
  public serves object _bytes_ over `/object/public/…`; it grants nothing on `storage.objects`, which
  is an ordinary table with its own RLS. Two things this plan needs are not byte reads:
  `.remove()` returns the deleted `FileObject[]`, so the API reads the rows before deleting them, and
  the sweep in decision 8 is `.list()`, which is pure `select`.
- **Verified 2026-08-08, and it is stronger than "may remove nothing".** Two halves, both checked
  rather than reasoned:
  - storage-api runs the user-facing delete **as the caller**, not as an admin — `storage/object.js`
    calls `this.db.deleteObjects(…)` where the bucket lookup two functions above deliberately uses
    `asSuperUser()`. The SQL it reaches is
    `delete from storage.objects where bucket_id = $1 and name = any($2) returning *`.
  - Postgres applies **SELECT policies to that statement**, because its `where` clause reads columns
    and it carries `returning`. Probed against the linked project on a throwaway RLS table, rolled
    back: with a permissive `for delete … using (true)` policy and no select policy, `authenticated`
    deleting one row by id affected **0 rows**. Adding a select policy made the identical delete work.
- **So without the grant, ✕ deletes neither the row nor the file**, and `.remove()` returns
  `{ data: [], error: null }` — indistinguishable from success, and invisible under decision 11.
  The narrowing decision 8 claims — that ✕ shrinks the leak to "closed the tab" — would quietly never
  have been true. This is a requirement, not insurance.
- **The shape already has a precedent:** every recipe table pairs its `authenticated writes X` policy
  with an `authenticated reads all X`. Storage is the same pattern, for the same reason.
- **Trade-off:** none identified. It widens `authenticated`'s reach over a bucket it can already write.

## 34. There is no ordering constraint between the drop and the function replace

- **Date:** 2026-08-08
- **Considered:** keep the plan's "this must land after the drop" rule · restate the rule with a
  different justification · merge the two migrations into one file · drop the ordering claim
- **Chosen:** drop it. The plan asserted the order mattered and then, two sentences later, gave the
  reason it cannot: `save_recipe` does not touch `recipe_images` today, and the new block never writes
  `alt`. Both orderings are safe, so the rule had no force and would cost the next reader the time it
  takes to work that out.
- **What survives is the part that does have force:** never write `alt` in the new images block. That
  is a code-review rule about one statement, not a sequencing rule about two files.
- **Why not merge them:** the destructive change would stop being visible on its own in the migration
  history, which is what `docs/database-workflow.md`'s gate convention is built around.
- **Trade-off:** none. A constraint was removed, not added.

## 35. Narrow 23505 by matching the slug constraint's name

- **Date:** 2026-08-08
- **Considered:** leave the branch unconditional and comment the hazard · match the constraint name in
  `error.message` · raise a domain error from inside `save_recipe` that app code can match on
- **Chosen:** `error.code === "23505" && error.message.includes("recipes_slug_key")`, with a comment
  saying plainly that this is a string match against a Postgres-generated message. Anything else that
  violates uniqueness now falls through to the generic save failure instead of claiming the title is
  taken.
- **There are five reachable unique constraints, not two.** `recipes_slug_key`,
  `recipe_ingredients (recipe_id, sort_order)`, `recipe_steps (recipe_id, step_number)`,
  `recipe_images (recipe_id, storage_path)` and the partial `recipe_images_one_primary_idx`. The
  ordering ones cannot fire — `with ordinality` generates their values — but both image constraints
  can the moment a gallery exists.
- **Why not the domain error:** it is the more robust design, and it makes `save_recipe` responsible
  for an error vocabulary it does not have today, via a plpgsql `exception` block that adds a
  subtransaction to the one write path. Not worth it for one branch.
- **Why not leave it:** `toPayload` sends at most one image, so nothing is reachable today — which is
  exactly the kind of comment that is still there, unread, when the gallery lands.
- **Trade-off:** a string match against a message Postgres formats, which is stable in practice and
  guaranteed by nothing. The constraint names are read rather than guessed —
  `recipes_slug_key`, `recipe_images_recipe_id_storage_path_key`,
  `recipe_images_recipe_id_sort_order_key`, `recipe_steps_recipe_id_step_number_key` and the partial
  `recipe_images_one_primary_idx`, confirmed against the linked project on 2026-08-08.

## 36. A narrow, primary-filtered embed for the list query

- **Date:** 2026-08-08
- **Considered:** `recipe_images(*)` mirroring `RECIPE_WITH_CHILDREN` · a narrow
  `recipe_images(storage_path)` filtered to the primary · denormalise `cover_path` onto `recipes`
- **Chosen:** `select("*, recipe_images(storage_path)")` with `.eq("recipe_images.is_primary", true)`,
  and a new `RecipeListItem = Recipe & { recipe_images: Pick<RecipeImage, "storage_path">[] }`.
  `getRecipesForAdmin` stays on `Recipes` — the manage page shows no covers.
- **Why the type is not optional:** `getRecipes()` returns `Recipe[]`, which is a bare table row.
  Adding any embed changes that type, and the plan named only `RecipeWithChildren`. The filter is what
  keeps the embed one row per recipe after a gallery exists, so `RecipeCard` never has to pick.
- **Why not denormalise:** the plan lists it as an open question and it is the right thing to defer —
  choosing it now means `save_recipe` writes the same path to two places that can disagree, to solve a
  list page that is not slow.
- **Trade-off:** a third recipe-shaped type alongside `Recipe` and `RecipeWithChildren`. Closes the
  plan's "whether `getRecipes()` should join images at all" open question.

## 37. The cover enters `RecipeView` flat, not as a row array

- **Date:** 2026-08-08
- **Considered:** `RecipeView` carries `recipe_images: Pick<RecipeImage, …>[]` and the article picks the
  primary · a flat `cover: string | null` plus `steps[].image_path` · the cover only, with step photos
  left out of the view
- **Chosen:** flat. `RecipeView` gains `cover: string | null` alongside its existing `Pick`s, and its
  steps gain `image_path`. `toRecipeView()` resolves the primary out of `recipe_images`;
  `toPreview()` reads the draft's union. The article never learns that a `recipe_images` row exists.
- **Why this shape:** `RecipeView`'s own comment says it is deliberately narrower than a row so a
  recipe that has never been saved can be rendered without inventing the parts a row would have. A
  row-shaped array would make the wizard fabricate a one-element list of fake image rows — the exact
  pattern that comment exists to prevent. The plan named `RecipeWithChildren` but never `RecipeView`
  or `toRecipeView()`, which is the type the article actually takes.
- **Why not the cover alone:** step photos would render in the wizard's field but not in the preview,
  so the preview would lie about what is being published — decision 12's one rule.
- **Trade-off:** a gallery later needs a view change rather than getting one free. Cheap, and it is the
  same trade decision 1 already took on the payload.

## 38. Keep `next/image`, on the strength of the 300px step photo

- **Date:** 2026-08-08
- **Considered:** plain `<img>` everywhere and drop `remotePatterns` · `next/image` everywhere ·
  `next/image` on public surfaces, `<img>` in the wizard
- **Chosen:** `next/image` everywhere. Decisions 3 and 13 make the stored file already final — 1200px
  square webp — which genuinely does undercut most of what the optimizer is for, so this needed
  checking rather than assuming.
- **The deciding number is decision 22's 300px step photo.** Serving the 1200px file into a 300px slot
  is roughly 250KB against 40KB, and six steps make that 1.5MB against 240KB. `srcset` and lazy
  loading pay for themselves there even though the cover, at 768px, barely benefits.
- **Second reason:** intrinsic width and height mean a landing photo cannot shift the article, which
  matters given decision 21 reserves space for exactly that hazard.
- **Why not the split:** `PreviewRail` renders the real `RecipeArticle` (decision 12), so a
  wizard-versus-public split would have to live _inside_ the shared component.
- **Trade-off:** `remotePatterns` stays a required config entry, and the optimizer costs transformations
  for files that were already the right format.

## 39. The thumbnail comes from the bucket, not from the blob

- **Date:** 2026-08-08
- **Considered:** hold the cropped blob as an object URL in component state, remote as fallback · a
  module-level `Map` of path → object URL · always `publicImageUrl(path)`
- **Chosen:** always the remote URL. Storage is read-after-write consistent, so the object is there the
  moment `.upload()` resolves.
- **Why:** it is the only option that adds no state. The plan's "no new state at all" line and
  decision 18's derived-everything shape both hold, and the field surviving panel unmount is free
  rather than something to arrange. The object-URL versions also need `URL.revokeObjectURL` cleanup and
  are lost on unmount anyway — so the remote path has to work regardless, and would get exercised less.
- **Trade-off:** one small CDN fetch for bytes that were in memory a moment ago.
- **Amended by 48**, which settles what element renders those bytes. This decision only settles where
  the `src` comes from.

## 40. Three milestones, with `RecipeArticle` in the wizard one

- **Date:** 2026-08-08
- **Considered:** one pass and one commit · two, splitting write path from read path · three
- **Chosen:** three. **1)** migrations, `lib/supabase/storage.ts`, `upload.ts` — nothing user-visible,
  verified at the SQL level and by a real upload. **2)** `CropDialog`, `ImageField`, the `draft.ts` and
  `RecipeWizard` changes **and `RecipeArticle` together**. **3)** `queries.ts`, the types,
  `RecipeCard`, `next.config.ts`, docs.
- **Why `RecipeArticle` belongs to milestone 2 rather than 3:** `PreviewRail` renders it, so splitting
  it out would end a milestone with a wizard preview that omits the photos just uploaded — the one
  thing decision 12 forbids.
- **Why not two:** the write-path-then-read-path split ends milestone 1 with a feature that stores
  photos nobody can see, including in the wizard's own preview.
- **Trade-off:** three stops each needing lint and typecheck green, on a feature whose pieces are
  genuinely interdependent.
- **Amended 2026-08-08: the split as written cannot end milestone 2 green.** `toRecipeView()` lives
  inside `RecipeArticle.tsx` and takes `RecipeWithChildren`, and both detail pages call it — so
  touching the article drags in three things milestone 3 was holding: `RecipeView`'s new fields (or it
  does not typecheck), `RecipeWithChildren.recipe_images` (or `toRecipeView` cannot read a cover), and
  the `RECIPE_WITH_CHILDREN` embed (or it typechecks and renders nothing). `next/image` throws on an
  unconfigured host, so `next.config.ts` cannot wait either. Moving `RecipeArticle` to milestone 3
  instead is the one repair this decision already rules out. **Corrected split:** milestone 2 becomes
  the wizard _and_ the detail page — both type changes, the `RECIPE_WITH_CHILDREN` embed and
  `next.config.ts` join it; milestone 3 becomes the public list and the docs — `getRecipes()`'s narrow
  embed, `RecipeListItem`, `RecipeCard`, the rewrites. Milestone 1 additionally ends with the upload
  smoke test described in 41.

## 41. No local stack; rehearse in the shadow database, verify against the linked project

- **Date:** 2026-08-08 · **rewritten the same day, after the probes below**
- **Considered:** `supabase start` plus a local `.env.local` so the whole pipeline runs against
  localhost · start the stack to verify migrations at the SQL level, app stays on the linked project
  (this decision's first answer) · no local stack at all
- **Chosen:** no local stack. `npm run db:diff` is the rehearsal, `db:push` is the apply, and
  `db query --linked` plus a browser smoke test are the verification. No `db:reset` script, no
  `supabase start`.
- **Why the first answer was withdrawn.** It rested on the local pass catching a migration that would
  not apply to hosted — and that risk was probed directly and does not exist. On the linked project
  `storage.objects` is owned by `supabase_storage_admin` and `postgres` is neither superuser nor a
  member of that role, exactly as feared, yet `create policy … on storage.objects` as `postgres`
  **succeeds** (probed inside a transaction that then aborted; zero policies left behind). `postgres`
  also carries `rolbypassrls` and `insert` on `storage.buckets`, so the bucket row applies too.
- **The rehearsal survives without the stack, which is what makes this cheap.** `db:diff` builds a
  shadow database and **replays every migration into it** — that is how a probe migration containing
  both `insert into storage.buckets` and `create policy on storage.objects` was applied and verified.
  A broken `create or replace`, a typo'd policy or a missing schema fails there, loudly, before
  anything reaches the real project. What the shadow does not give you is a database left standing to
  query afterwards.
- **It also settles an ordering worry nobody raised:** the storage schema ships inside the Postgres
  image, so `insert into storage.buckets` cannot run before `storage` exists.
- **What replaces the local assertion.** After `db:push`: the documented `db query --linked` snippet
  from 43 for the bucket row and the four policies, then a **console smoke test on `/admin` while
  signed in that calls `upload.ts`'s own helpers** — upload, list, remove — rather than raw
  supabase-js. That exercises `PATH_PREFIX`, the blob's `type`, the year-long `cacheControl` and the
  remove semantics of 33, which is the code the app will actually run. `upload.ts` therefore stays in
  milestone 1: it is what milestone 1 verifies with.
- **Why not `supabase start` anyway:** `db reset` refuses without it, and a full start pulls kong,
  postgrest, studio, pg-meta, imgproxy, mailpit, vector and supavisor on top of what is already
  cached — a multi-gigabyte prerequisite for a check whose justification has just been removed.
- **Trade-off:** a forgotten `insert` policy is now discovered on the hosted project rather than
  before it. The smoke test is what makes that a thirty-second discovery instead of a milestone-2
  mystery.

## 42. The bucket stays a migration-only artifact

- **Date:** 2026-08-08
- **Considered:** declare it in `config.toml` for local and in a migration for hosted · migration only ·
  delete the commented `[storage.buckets.images]` block so the question cannot arise
- **Chosen:** migration only — the plan's conclusion, but its reason has to change. It said the
  `config.toml` block is "a red herring: it configures the local Docker stack, which this project
  cannot run." Docker is installed now, so that sentence is false.
- **The conclusion gets stronger, not weaker.** Migrations reach both the hosted project and any
  throwaway or local database the CLI builds — a probe migration's `insert into storage.buckets`
  applied cleanly in `db:diff`'s shadow database, which runs no storage service at all. Declaring the
  bucket in `config.toml` as well would be a second definition that only a local stack reads, letting
  local and hosted disagree on public, size limit and MIME list with nothing comparing them — and per
  decision 43 nothing but a hand-run query would.
- **Amended by 41:** this decision's first version leaned on `db reset` existing. It no longer does,
  and the conclusion is unaffected — a `config.toml` bucket would now configure a stack this project
  never starts, which is where this reasoning stood before Docker was installed at all.
- **Why not delete the block:** it is CLI boilerplate a future `supabase init` puts back, and removing
  it makes this plan edit a file it otherwise never touches.
- **Trade-off:** the bucket's settings live in SQL rather than in a config file where they would be
  easier to eyeball.

## 43. Storage policies get their own diff command; the bucket row is the gap that stays

- **Date:** 2026-08-08 · **rewritten the same day, after the engines were actually compared**
- **Considered:** widen `db:diff` to `--schema public,storage` · a second `db:diff:storage` script ·
  a `scripts/check-storage.mjs` assertion · record the gap and rely on a deliberate `db query`
- **Chosen:** a second script — `"db:diff:storage": "supabase db diff --linked --schema storage
--use-migra"` — for the policies, plus a documented `db query --linked` snippet in
  `image-storage.md` for the bucket row, which no diff can ever cover.
- **The first version of this decision said storage drift was undetectable. Half of that was wrong.**
  Tested by planting a policy in a throwaway migration that the linked project did not have:
  - `db diff --linked --schema storage` on the default **pg-delta** engine printed
    `No schema changes found` — it does not merely omit storage, it actively reassures.
  - the same command with **`--use-migra`** printed
    `drop policy "zz probe select" on "storage"."objects"`, correctly.
  - on a clean tree, `--use-migra --schema storage` prints nothing, so the check is noise-free today.
    The "signal arrives mixed with noise from storage's own upgrades" argument against widening was
    speculation, and it is currently false.
- **What stays true:** the bucket is a **row** in `storage.buckets` — data, not schema — so no diff
  engine will ever see it whatever the scope. `No schema changes found` can still print while the
  bucket is missing, public when it should not be, or wide open on MIME.
- **Why this deserves saying out loud:** `CLAUDE.md` tells you never to change structure in the
  dashboard because drift is invisible. The four recipe tables have a backstop; storage policies now
  have one too, but only under a non-default engine — so the trap worth recording is that the
  _default_ engine says storage is fine when it is not.
- **Why not switch the project to migra** (`[experimental.pgdelta] enabled = false`, one command
  covering both schemas): it downgrades the engine for every future diff to fix one schema's blind
  spot, and pg-delta is where the CLI is heading. The cost of the split is one sentence explaining why
  the neighbouring command uses a different engine.
- **Why not the script:** `check-storage.mjs` would cover both layers, but it is a new file with no
  precedent in the repo, for a bucket that changes approximately never. Worth revisiting if storage
  grows a second bucket.
- **Trade-off:** two diff commands with two engines, and migra is labelled legacy in `config.toml` —
  a future CLI could remove it, at which point the check fails loudly rather than silently. The
  bucket's settings still depend on a human running a query.

## 44. One `PATH_PREFIX`, with the regex built from it

- **Date:** 2026-08-08
- **Considered:** leave it as the logged open question the plan already had · build the regex from a
  shared prefix constant · make the regex authoritative and have the builder assert against it
- **Chosen:** `const PATH_PREFIX = "recipes/"`, with the validation regex built from it by template and
  the builder as `` `${PATH_PREFIX}${crypto.randomUUID()}.webp` ``. The prefix cannot disagree with
  itself.
- **Why close it rather than log it:** `lib/supabase/storage.ts` is a brand new file, and the plan
  itself names the hazard — the convention stated in two places, joined only by convention, where a
  change to one silently breaks saves. Logging a self-inflicted footgun in a file that does not exist
  yet is a strange thing to do.
- **Why not the assertion:** it covers the uuid shape and extension too, but puts a dev-only runtime
  branch inside a pure string function the server also imports. The prefix is the part decision 5 says
  might actually change; the rest is the part nobody touches.
- **Trade-off:** the uuid shape and `.webp` are still stated twice. Closes one of the plan's four open
  questions.

## 45. Derive the Supabase hostname from the env var in both places

- **Date:** 2026-08-08
- **Considered:** hardcode a `*.supabase.co` wildcard in `remotePatterns` · derive the hostname from
  `NEXT_PUBLIC_SUPABASE_URL` in both `next.config.ts` and `storage.ts`
- **Chosen:** derive it. `next.config.ts` uses `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname`,
  and `publicImageUrl` normalises with `.replace(/\/$/, "")` so a trailing slash in `.env.local` cannot
  produce `//storage/v1`.
- **Why:** one source, and it survives a project move — which is the same reason the columns store
  paths rather than URLs. A wildcard would also let any Supabase project's images through the
  optimizer.
- **Trade-off:** `next.config.ts` now reads env at build time, so a missing variable fails the build.
  That is the posture the Supabase clients already take at import, so it is not a new rule.
- **Why normalise at all:** without it the failure is a 404 on every image from a doubled slash, which
  reads as a storage problem rather than as a one-character config typo.

## 46. Upload failures get written messages, not Postgres strings

- **Date:** 2026-08-08
- **Considered:** pass the raw Supabase message through as `reason` · one generic message with the real
  error logged · map known failures to written messages with a generic fallback
- **Chosen:** the mapper, in `upload.ts`: 401/403 → the session expired and the photo needs
  re-attaching, 413 or the bucket size limit → too large after compression, the MIME rejection → the
  file was not accepted. Anything else falls back to a generic line carrying the raw message.
- **Why the union's `reason` needed specifying at all:** the plan defined the field and rendered it on
  Review without ever saying what is in it. The realistic contents are Supabase storage errors, so an
  expired session reads as "new row violates row-level security policy" on the Review panel of a
  cooking site.
- **Routed through one helper**, for the reason decision 25 already gives about `slugTakenMessage`: the
  field and the Review alert both render this, and they must not word the same failure differently.
- **Why not fully generic:** an expired session and an oversized file would look identical, and the
  retry button will fail the same way for the first of those.

## 47. One `busy`, one word — `processing` and `uploading` are not distinguishable

- **Date:** 2026-08-08
- **Considered:** widen the union to `{ status: "busy"; phase: "cropping" | "uploading" }` so the label
  can change mid-flight · keep the union and hold the phase in `ImageField`'s own state · keep the
  union and use one word
- **Chosen:** one word. `busy` maps to `attachment.tsx`'s `state="uploading"` with a single label.
- **Why:** the plan told `ImageField` to render `processing` while the canvas works and `uploading`
  while the bytes go, but `StepImage` has one `busy` and cannot tell them apart. Reading the component
  settles it in the other direction: `processing` and `uploading` render **identically** — the same
  shimmer on the title, nothing else differing. The distinction the wider union would buy is a
  distinction the UI does not draw.
- **Why not local phase state:** it dies with the panel, so returning to a step mid-upload shows the
  wrong word — the same unmount failure decision 18 rejected, for a smaller prize.
- **Trade-off:** the label reads "uploading" during the ~200ms of canvas work. Nobody will see it.

## 48. A plain `<img>` for the field thumbnail; `next/image` on the article only

- **Date:** 2026-08-08
- **Considered:** `next/image` everywhere, so there is one way to render a stored photo · a plain
  `<img>` inside `AttachmentMedia`
- **Chosen:** a plain `<img>` in `ImageField`; `next/image` keeps the article's hero and 300px step
  photos, which is what decision 38 actually argued for.
- **Why the exception:** 38's case was serving a 1200px file into a 300px slot, six times per page.
  The field thumbnail is ~64px, fetched seconds after its own upload, looked at once, and then gone —
  warming a CDN variant for it buys nothing, and `AttachmentMedia` already styles a child `img`
  (`aspect-square`, `object-cover`) rather than sizing by intrinsic dimensions.
- **Trade-off:** two ways of rendering a stored photo, which needs one comment at the `<img>` saying
  which case this is and why it is not the article's case.

## 49. Pull in `slider` rather than a bare range input

- **Date:** 2026-08-08 · closes the plan's second open question
- **Considered:** `npx shadcn@latest add slider` · the bare `<input type="range">` the prototype uses
- **Chosen:** the registry component.
- **Why it was close and then wasn't:** the honest argument for the bare input was avoiding a
  dependency for a control used a handful of times a week. There is no dependency — this project's
  shadcn primitives import from the unified `radix-ui` package, which is already installed, so this is
  a file copy-in. The prototype's own notes say the raw control does not match the UI, and it sits
  inside a shadcn `Dialog` in the one screen the owner touches for every photo.
- **Trade-off:** one more generated file in `components/ui/` to leave unedited.

## 50. A zero-row `.remove()` stays silent, and the asymmetry gets a comment

- **Date:** 2026-08-08
- **Considered:** treat `data.length === 0` as an error, matching the row delete beside it ·
  `console.warn` the mismatch · treat it as success
- **Chosen:** treat it as success, per decision 11 — with a comment naming why the neighbouring line
  does the opposite.
- **Why the comment is not optional:** `deleteRecipe` already does
  `.delete().select("id")` and errors when nothing came back, under the comment _"an RLS refusal on a
  delete is silent, so the affected rows are checked"_. The new storage cleanup lands in that same
  function and deliberately does not. Unexplained, that reads as an oversight and gets "fixed".
- **The distinction to write down:** a zero-row **row** delete means the user's intent failed and is
  actionable. A zero-row **file** remove means the intent succeeded — the photo is off the recipe —
  and a file leaked, which the owner cannot act on and which the sweep in decision 8 exists for.
- **Trade-off:** the one fingerprint of a regressed `select` policy (decision 33) goes unreported.
  Accepted knowingly: `db:diff:storage` from 43 is what catches that, and it catches it earlier.
- **Trade-off:** a mapping keyed on status codes and message fragments, which can go stale against
  Supabase's wording. The fallback carries the raw message, so a stale mapping degrades to option one
  rather than to silence.
