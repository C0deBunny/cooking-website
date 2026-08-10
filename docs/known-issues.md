# Known issues

Things found and deliberately not fixed yet. Each entry records what is wrong, why it was deferred,
and what fixing it would take — so a later session doesn't have to rediscover it.

Companion to [schema-current.html](schema-current.html), which is generated from the live schema —
see [database-workflow.md](database-workflow.md).

Two larger open topics have their own docs rather than an entry here:
[image-storage.md](image-storage.md) (the bucket, its policies and the path convention) and
[permission-model.md](permission-model.md) (the two-role model, and what a rebuild would take).

## 1. Reordering collides on the unique constraint — now a gallery editor problem only

- **Found:** 2026-08-01, while diagramming the schema
- **Status:** **resolved for all three child tables.** `save_recipe()` replaces a recipe's steps,
  ingredients and images wholesale on every save, so their positions are rewritten from array order
  and the old rows are gone before the new ones land — there is never an interleaved swap to
  collide. Images joined that list on 2026-08-08 with the recipe-images work; until then they were
  the outstanding case. What is left below describes a hypothetical gallery editor that patches
  rows in place, which nothing does.
- **Where:** `supabase/migrations/20260801122716_initial_schema.sql` for steps and ingredients;
  `20260801145317_recipe_content_fields.sql` for the image constraint;
  `20260808140818_save_recipe_images.sql` for the images block that resolved it

Both constraints are non-deferrable, so Postgres checks them after **every row** of an `update`, not
at the end of the statement. Swapping two positions therefore fails halfway through:

```sql
-- step 2 and step 3 trade places
update recipe_steps set step_number = 3 where id = 10;  -- ok? no —
-- fails: step 3 still belongs to id 11 at this instant
```

The same applies to shifting a block of rows up or down by one, which is what a drag-and-drop reorder
actually emits. It is not a race condition and not a Supabase quirk — a single statement updating
several rows hits it too, because the constraint is evaluated per row.

**Options when this becomes in scope:**

- `deferrable initially deferred` on the two constraints — the check moves to commit time, so any
  intermediate state is legal inside a transaction. Cheapest fix, one migration. Note that Postgres
  cannot use a deferrable unique constraint to back a foreign key, which does not matter here since
  nothing references those columns.
- Two-pass update — move the affected rows to negative or offset positions, then into place. No
  migration, but every write path has to remember to do it.
- Fractional or gapped ordering (`numeric` positions, or integers spaced by 100) so an insert between
  two rows never needs to touch its neighbours. Changes the column type and needs an occasional
  renumber, but it is the shape that scales to real drag-and-drop.

Worth settling as part of the schema redesign rather than patching later — the choice affects the
column type, so it is cheaper to decide before there is data.

## 2. One refresh empties the recipe wizard

- **Found:** 2026-08-01, designing `/admin/create` — a scope cut, not a discovery
- **Status:** accepted and deliberate. Decisions 13 and 14 of
  `docs/plans/admin-create-wizard/decisions.md`
- **Where:** `app/admin/_components/recipe-wizard/RecipeWizard.tsx`

The draft lives in `useState` and nothing else. There is no autosave, no `beforeunload` warning,
and no `localStorage` mirror, and there is no Save Draft button either — a recipe is written once,
on the last step, and the publish switch there is what decides draft versus live.

So one accidental refresh, one closed tab, or one click on a sidebar link discards four steps of
typing with no warning and no recovery. That is meaningfully worse than the single-page form it
replaced, which lost the same data but only ever held one screen of it.

Why it is not fixed: each option carries a cost that was not worth paying for a screen used a few
times a month by one person.

- **`localStorage` with a "restore draft?" prompt** — the cheap fix, and the one to reach for
  first if this starts biting. Needs a rule for when the stored draft is stale, and a second one
  for what happens when a restore is offered on top of a wizard the user has already started
  filling in.
- **A `beforeunload` warning** — catches the refresh and the closed tab, but not an in-app
  navigation, which is the likelier way to lose it. Browsers also ignore it until the page has
  been interacted with.
- **A real Save Draft button** — the trap is the id. A recipe has no id until its first save, so a
  button that saves and stays has to thread the returned id back into the draft; miss that and the
  second click inserts a second recipe, or trips 23505 on the slug. That is why `saveRecipe`
  redirects rather than returning.

## 3. ~~`recipe_images.sort_order` is not unique per recipe~~ — RESOLVED

- **Found:** 2026-08-01, same pass
- **Resolved:** 2026-08-01, in the migration written the same day
- **Status:** **fixed.** `20260801145317_recipe_content_fields.sql:72` adds
  `constraint recipe_images_recipe_id_sort_order_key unique (recipe_id, sort_order)`.
- **Where:** `recipe_images`

Kept as a record because the fix moved the problem rather than ending it: gaining the constraint is
exactly what pulled `recipe_images` into issue 1 above. See that entry for the live problem.

**The original gap**, for context: `recipe_steps` and `recipe_ingredients` were each unique on
`(recipe_id, <ordering column>)` from the start, while `recipe_images` was unique on
`(recipe_id, storage_path)` only — which prevents the same file being attached twice but says nothing
about position. Two images could hold `sort_order = 0`, and `sort_order` defaults to `0`, so
inserting several images without setting it explicitly was the easy path into exactly that state.

All three child tables are now unique on their ordering column, so that is the correct wording for
`CLAUDE.md` and [database-workflow.md](database-workflow.md).

## 4. ~~Orphaned files accumulate in the `recipe-images` bucket~~ — RESOLVED

- **Found:** 2026-08-06, designing the recipe-images work — an accepted cost, not a discovery
- **Resolved:** 2026-08-09, by `docs/plans/orphan-image-sweep/`
- **Status:** **collected automatically.** `lib/images/sweep.ts` runs from `after()` at the end of
  `saveRecipe` and `deleteRecipe` — the two events that can have caused a leak — lists the bucket,
  asks `unreferenced_image_paths()` which paths nothing references, and removes up to 25 of them
  oldest-first. It needs no new credential and no new endpoint because `after()` runs inside the
  request's own auth context.
- **Where:** `lib/images/sweep.ts`,
  `supabase/migrations/20260809202910_unreferenced_image_paths.sql`, `lib/recipes/actions.ts`

> **The residual cost does not vanish with this entry.** An orphan lives for at least seven days
> (the age floor, which exists so a second open wizard tab's photos are never deleted out from
> under it), nothing is collected at all if the owner never writes again, and a broken sweep looks
> exactly like a working one — there is no page and no heartbeat. That caveat, and the probe that
> is the only way to check it, live in [image-storage.md](image-storage.md) under question 7.

Kept as a record of what the problem was, and of which fixes were rejected on the way to this one.

Photos are uploaded the moment they are cropped, so the file exists before the recipe does. Nothing
reconciled the bucket against the rows, and there are three ways a file ends up referenced by
nothing:

- **An abandoned wizard session.** Upload a photo, close the tab, and the object stays. The ✕
  control deletes its file immediately, so this narrows to "closed the tab" — a handful of files a
  year for a single-owner site.
- **A replaced image, once an edit path exists.** `save_recipe()` replaces `recipe_images`
  wholesale, and Postgres has no idea the bucket exists.
- **A storage failure during a delete.** `deleteRecipe` removes files best-effort and never fails
  on it, deliberately: the recipe genuinely was deleted, so reporting otherwise would be false.
  Nothing surfaces the leak.

`beforeunload` cleanup was rejected — browsers do not guarantee the request lands, and it would fire
on a deliberate refresh too, deleting files from a session the user was about to resume. It stayed
rejected; so did an admin page with a sweep button, and every scheduled variant (Vercel Cron, an
Edge Function, `pg_cron`) — all three run with nobody signed in, so all three need a service-role
key. Decisions 1 and 5 of `docs/plans/orphan-image-sweep/decisions.md`.

**The fix that shipped** is the sweep this entry described: list the bucket, diff against
`recipe_images.storage_path ∪ recipe_steps.image_path`, delete what nothing references — triggered
by the writes that create the leak rather than by a screen.

> ⚠ **Only objects older than the age floor are candidates.** A file uploaded thirty seconds ago by
> a wizard that is still open is unreferenced but _not_ orphaned, and a naive diff would delete a
> photo out from under a live editing session. The 24 hours guessed here became **seven days** in
> `MIN_AGE_MS`: the floor's only cost is how long an orphan lingers, which nothing observes, and its
> benefit is never breaking a live recipe.

The sweep's `.list()` needs the `select` policy on `storage.objects` that
`20260808140816_recipe_images_storage.sql` already grants — see
[image-storage.md](image-storage.md). Its anti-join has a second dependency, recorded in the
migration itself: it is `security invoker`, so it is only correct while `authenticated` can read
**every** row of `recipe_images` and `recipe_steps`. Narrow either SELECT policy and unreadable rows
start reporting as unreferenced.

## 5. Storage drift is invisible to the default diff engine, and the bucket row to every engine

- **Found:** 2026-08-08, comparing the engines rather than assuming
- **Status:** partially mitigated by `npm run db:diff:storage`; the bucket row cannot be covered
- **Where:** `package.json`, `supabase/migrations/20260808140816_recipe_images_storage.sql`

`CLAUDE.md` says never to change structure in the dashboard because drift is invisible. The four
recipe tables have `npm run db:diff` as a backstop. Storage has two gaps behind that rule:

- **The policies** on `storage.objects` are diffable, but only under the non-default engine.
  `supabase db diff --linked --schema storage` on the default **pg-delta** engine prints
  `No schema changes found` over a planted policy — it does not merely omit storage, it actively
  reassures. The same command with `--use-migra` reports the drift correctly. That is what
  `npm run db:diff:storage` runs, and why it uses a different engine than the `db:diff` beside it.
- **The bucket is a row**, not schema — `storage.buckets` holds data — so no diff engine will ever
  see it whatever the scope. `No schema changes found` can print while the bucket is missing,
  public when it should not be, or wide open on MIME.

Check the bucket by hand instead:

```
npx supabase db query --linked "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recipe-images'"
```

Expected: `public = true`, `file_size_limit = 2097152`, `allowed_mime_types = {image/webp}`.

Switching the project to migra wholesale (`[experimental.pgdelta] enabled = false`) would let one
command cover both schemas, at the cost of downgrading every future diff to fix one schema's blind
spot — and pg-delta is where the CLI is heading. A `scripts/check-storage.mjs` covering both layers
is the thing to build if storage ever grows a second bucket.

## 6. `/admin` does not work on a phone, including the photo screens

- **Found:** 2026-08-06, designing the recipe-images work
- **Status:** accepted and deliberate. Decision 28 of `docs/plans/recipe-images/decisions.md`
- **Where:** `app/admin/_components/AdminSidebar.tsx`, the whole `recipe-wizard/` folder

`/admin` is desktop-first: the sidebar is `collapsible="none"` with a fixed 16rem rail, `PreviewRail`
is hidden below 1024px, and the crop dialog is a centred modal with a drag surface that would fight
browser chrome on a phone.

The tension worth writing down is that **the photos come from a phone.** The upload pipeline
compresses in the browser precisely because a phone photo is 4–12MB — and then the only place you
can run it is a laptop, so the photo has to reach the laptop first. That is the current workflow and
it is fine for a site updated a few times a month; it is not an oversight.

Making the wizard responsive would mean a narrow layout for `DetailsPanel`'s two-column row, a
`Sheet` or drawer for the preview, and revisiting `Dialog` for the cropper. All additive.

## 7. An existing recipe cannot gain a cover photo

- **Found:** 2026-08-08, re-checking decision 23's assumption that pre-image recipes shrink over time
- **Status:** accepted. Amendment to decision 23 of `docs/plans/recipe-images/decisions.md`
- **Where:** `app/admin/` — there is no edit route

The wizard is create-only. `app/admin/` holds create, manage, preview and tags, and the only write
actions are `saveRecipe`, `togglePublished` and `deleteRecipe` — so the recipes that existed before
photos did cannot receive one without being deleted and retyped, which would change live URLs.

The consequence is that `RecipeCard`'s generated tile — a square tinted from the slug carrying the
title's first letter — is the **permanent** look for those recipes rather than a transitional state,
and the grid stays mixed indefinitely. That was accepted knowingly: a cover-only edit affordance
would reverse the plan's create-only non-goal, and the tile was chosen to look intentional rather
than like a gap.

The draft shape the wizard uses is the shape an edit would hydrate into, so a real edit path is
wiring rather than a rewrite — including for images, where a saved `recipe_steps.id` drops into the
same `StepDraft.id` field the uploads already write back through.

## 8. `Separator` renders 0px unless the caller supplies a border

- **Found:** 2026-08-10, measuring the publish bar's divider during the review-and-publish revamp
- **Status:** open, unfixed. One-line fix in a generated file, so it needs a decision first
- **Where:** `components/ui/separator.tsx`; visible consequence in `components/shared/RecipeArticle.tsx`

The component's classes are `data-horizontal:h-px data-horizontal:w-full data-vertical:w-px
data-vertical:self-stretch`, and **radix sets `data-orientation`, never `data-horizontal`.** Tailwind
reads `data-horizontal:` as the bare attribute selector `[data-horizontal]`, so none of those four
utilities ever match: every `<Separator>` gets `height: 0` (horizontal) or `width: 0` (vertical) and
paints nothing. Measured in the browser — `RecipeArticle`'s two `<Separator className="my-12" />`
rules are 720px × **0px**, so the Ingredients/Method/Notes dividers are invisible on the public
recipe page, the draft preview and the wizard's preview alike. The navbar's dividers look fine only
because they add `border-l border-border` themselves, which is the workaround the publish bar copies.

The fix is `data-[orientation=horizontal]:` / `data-[orientation=vertical]:`, which is what current
shadcn ships. It is held back for two reasons: `components/ui/` is regenerated rather than
hand-edited (see `CLAUDE.md`), so the durable fix is a `shadcn` re-add rather than a patch; and it
changes the **public** recipe page's appearance — three horizontal rules appear where there are none
today — which is a design call, not a bug fix to be slipped into an unrelated diff.
