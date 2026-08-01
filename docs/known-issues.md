# Known issues

Things found and deliberately not fixed yet. Each entry records what is wrong, why it was deferred,
and what fixing it would take — so a later session doesn't have to rediscover it.

Companion to [schema-current.html](schema-current.html), which mirrors the live schema.

Two larger open topics have their own docs rather than an entry here:
[image-storage.md](image-storage.md) (no bucket exists yet — blocks the create form) and
[permission-model.md](permission-model.md) (the two-role model, and what a rebuild would take).

## 1. Reordering collides on the unique constraint — now images only

- **Found:** 2026-08-01, while diagramming the schema
- **Status:** **resolved for steps and ingredients, still open for images.** `save_recipe()`
  replaces a recipe's steps and ingredients wholesale on every save, so their positions are
  rewritten from array order and the old rows are gone before the new ones land — there is never
  an interleaved swap to collide. Images are not written by that function (no Storage bucket
  exists yet), so they are still patched row by row, and `recipe_images` gained
  `unique (recipe_id, sort_order)` in the same migration. The problem below now describes the
  gallery editor and nothing else. Decide it with the Storage work.
- **Where:** `supabase/migrations/20260801122716_initial_schema.sql` for steps and ingredients;
  `20260801145317_recipe_content_fields.sql` for the image constraint that inherited the problem

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

## 3. `recipe_images.sort_order` is not unique per recipe

- **Found:** 2026-08-01, same pass
- **Status:** agreed to fix — it should be unique. Folded into the schema redesign.
- **Where:** same migration, `recipe_images`

`recipe_steps` and `recipe_ingredients` are each unique on `(recipe_id, <ordering column>)`.
`recipe_images` is unique on `(recipe_id, storage_path)` instead — which prevents the same file being
attached twice, but says nothing about position. Two images in one recipe can hold `sort_order = 0`,
and since row order in Postgres is never guaranteed, the gallery renders them in an arbitrary and
potentially unstable order.

`sort_order` also defaults to `0`, so inserting several images without setting it explicitly is the
easy path into exactly that state.

Fixing it means adding `unique (recipe_id, sort_order)` — which then inherits issue 1 above, so the
two should be decided together. Existing duplicate positions would have to be renumbered before the
constraint can be added.

**Note:** `CLAUDE.md` described all three child tables as unique on their ordering column. That line
was corrected on 2026-08-01 to describe the schema as it actually is; it goes back to the simpler
wording once this is fixed.
