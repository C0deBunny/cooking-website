# Progress: Recipe images

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-08

- **Did:** all three milestones, uncommitted on `feat/recipe-images`.
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
