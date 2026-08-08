# Progress: Recipe images

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-08 — end-to-end pass

- **Did:** built a real recipe through the wizard over CDP — cover from a photo, four ingredients
  including `1/2` and `0,5`, three steps with photos on 1 and 3 (a 900×1400 portrait and a 1600×900
  landscape, so two aspect ratios went through the same square cropper) — published it, checked all
  three surfaces, then deleted it.
- **Verified, and all of it held:**
  - three uploads, three 200s, three uuid paths under `recipes/`;
  - Review's checklist read `4 ingredients, serves 4` / `3 steps`, save enabled;
  - redirect to `/admin/preview/<slug>`, and the article renders the square hero overlaid at column
    width with badge, title, description and the meta row, plus 300px step photos indented to the
    text column and step 2 correctly bare;
  - `next/image` served 768px for the hero, 300px for the step photos and 474px for the card —
    decision 38's whole argument, working;
  - `1/2 tl` and `0,5 kop` both rendered `½`, so `parseAmount` and the fraction glyphs survived the
    round trip;
  - `/recipes` showed the mixed grid decision 23 predicted: one real cover beside five generated
    tiles;
  - `/recipes/<slug>` renders identically to the preview.
- **`deleteRecipe`'s file cleanup verified end to end:** the three objects went 200 → 400 and the row
  left `/admin/manage`. That is the read-paths-then-delete-row-then-remove-files order working
  through both `recipe_images` and `recipe_steps`.
- **Fixed along the way: the generated tile's colours were systematically clustered.** `hash * 31 + c`
  over an alphabet of lowercase ASCII and hyphens left the last few characters dominating, and four
  of the six recipes landed within 40° of each other — a grid of near-identical purple squares, under
  a comment claiming the hues were spread. Now FNV-1a, with lightness and chroma varied over ranges
  wide enough to see, because hue alone at a fixed lightness is the same square twice at 7° apart.
  It still cannot guarantee distinct tiles and the comment now says so.
- **Still unrun:** EXIF-portrait orientation, HEIC, and a non-webp blob against the bucket allowlist
  — all three need files the pass could not synthesise. Reorder and delete mid-upload are also
  untested.

## 2026-08-08 — browser pass

- **Did:** drove the real pipeline over CDP against a signed-in session, and fixed the one bug it
  found.
- **The bug: `CropDialog` opened showing an empty square, and failed quietly.** Its setup effect
  early-returned when `stageRef`/`imageRef` were still null — which they are on the commit where
  `open` flips true, because `Dialog` renders into a portal — and its only dependency is the
  bitmap, which never changes again. So the setup was cancelled rather than deferred: the canvas
  kept its default 300×150 and was never painted, and `view` kept `{scale: 1, min: 1, x: 0, y: 0}`.
  **Confirm still produced a real photo**, because `sourceRect()` reads valid numbers off those
  defaults — the top-left corner of the source at the viewport's pixel size. The upload was
  416×416 instead of 1024×1024, with no framing the user chose, and everything downstream looked
  like it had worked. Fixed by moving the ref check inside the existing rAF retry loop.
- **Verified after the fix:** decode → dialog paints → drag and wheel-zoom → `POST /storage/v1/…`
  200 → the thumbnail loads from the bucket at 1024×1024 → the live preview's hero renders through
  `/_next/image` off the Supabase host, so `remotePatterns` is right.
- **Decision 33's `select` grant proved end to end**, which was the plan's smoke test: clicking ✕
  sent `DELETE` → 200, the object's public URL went 200 → 400, and the field cleared. On write
  policies alone that delete would have removed nothing and still reported success.
- **Left behind:** one orphaned object from the pre-fix run,
  `recipes/ea7fcce3-6c10-4f8c-bd44-53852c1594cc.webp`. `supabase storage rm` on CLI 2.109 returns
  `{"deleted":[]}` without error for a single object, so it is a dashboard delete. A live instance
  of known issue 4, which is at least on-theme.
- **Still unrun:** the EXIF-portrait pass, HEIC, a non-webp blob against the allowlist, reorder and
  delete mid-upload, and `deleteRecipe`'s file cleanup through a real recipe.

## 2026-08-08

- **Did:** all three milestones, committed to `feat/recipe-images`.
  - **M1** — `20260808140816_recipe_images_storage.sql` (bucket + four policies),
    `20260808140817_recipe_images_drop_alt.sql` (gated drop),
    `20260808140818_save_recipe_images.sql` (images block). Plus `lib/supabase/storage.ts`,
    `recipe-wizard/upload.ts`, and the `db:diff:storage` script.
  - **M2** — `slider` from the registry, `CropDialog`, `ImageField`, the `draft.ts` union +
    stable `id` + `replaceById`, `RecipeWizard`'s two write-backs and two derived memos, the three
    panels, `RecipeArticle`'s hero / reserved square / 300px step photos, `RecipeView`,
    `RecipeWithChildren`, the `RECIPE_WITH_CHILDREN` embed and `next.config.ts`.
  - **M3** — `getRecipes()`'s narrow primary-filtered embed, `RecipeListItem`, `RecipeCard`'s media
    area and generated tile, `deleteRecipe`'s file cleanup, the 23505 narrowing, and the doc
    rewrites (`image-storage.md`, four `known-issues.md` entries, `CLAUDE.md`,
    `permission-model.md`).
- **Verified:** `db:diff` rehearsal clean before and after review edits; `db:push` applied all three;
  bucket row confirmed `public / 2097152 / {image/webp}` by query; all four policies confirmed in
  `pg_policies`, scoped to the bucket and `{authenticated}` only; `db:types` regenerated and `alt` is
  gone; `db:diff:storage` clean under migra. `lint`, `typecheck`, `build` and `format` all green;
  `/recipes` still prerenders with a 15m revalidate.
- **Reviewed:** a subagent diffed the restated `save_recipe()` body line-by-line against
  `20260801190718` — no unintended differences. Three findings acted on: `is_primary` gained the
  `nullif(…, '')` wrapper every other cast in the function has; the four `create policy` statements
  gained `drop policy if exists` so the file survives a replay like its own bucket upsert does; and
  the "an image row with no `is_primary` renders nowhere" hazard got a comment rather than an
  `ord = 1` default, which was the owner's call.
- **Closed:** decision 41's open risk — `create policy` on `storage.objects` succeeded under
  `db:push` on the linked project, as predicted.
- **Next / blocked:** the manual passes from the plan's Verification section — pipeline (EXIF
  portrait, HEIC toast, non-webp rejection), concurrency (reorder and delete mid-upload, publish
  blocked), lifecycle (delete a recipe with photos, abandon a wizard) — all need a signed-in browser
  and are the owner's to run. Nothing is committed yet.
