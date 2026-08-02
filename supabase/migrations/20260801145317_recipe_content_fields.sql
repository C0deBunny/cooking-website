-- Content fields the recipe detail page needs, plus the image-ordering gap closed.
--
-- Written as an ALTER delta rather than a drop-and-recreate. The initial migration recreated
-- everything because it was replacing tables built by hand in the Table Editor; these tables
-- now carry RLS policies and grants, and restating them would leave two migrations both
-- defining `recipes` with only the filename timestamps to say which one wins.
--
-- Full reasoning: docs/plans/recipe-schema-redesign/decisions.md

-- ---------------------------------------------------------------------------
-- recipes: split the time column, add a notes block
-- ---------------------------------------------------------------------------
-- time_minutes is dropped rather than renamed. One opaque total can't say that 20 minutes of
-- a 110-minute recipe is work and the remaining 90 are unattended stewing, which is most of
-- the reason to state a time at all. Verified before writing this that nothing in app/,
-- components/ or lib/ reads the column, so the drop breaks no readers and `npm run typecheck`
-- passing straight after is a real signal.
--
-- Both new columns are nullable: plenty of recipes only have one of the two worth stating.
-- There is deliberately no generated total column — with coalesce, a recipe with neither
-- recorded would report 0, making 0 mean both "instant" and "never filled in". The total is
-- computed where it is displayed instead.
--
-- The `is null or` half of each text check is what makes these usable on a nullable column:
-- absent stays legal, blank does not. Without it an empty string would sail through and the
-- page would render an empty notes block or a heading with no text.

alter table public.recipes
  drop column time_minutes,
  add column prep_minutes int check (prep_minutes > 0),
  add column cook_minutes int check (cook_minutes > 0),
  add column notes text check (notes is null or length(trim(notes)) > 0);

-- ---------------------------------------------------------------------------
-- recipe_ingredients: headed sections
-- ---------------------------------------------------------------------------
-- "For the sambal", "To serve". Null means the ingredient belongs to no group and renders
-- above the first heading.
--
-- Deliberately a denormalized label rather than an ingredient_groups table. Group order is
-- "order of first appearance", which costs nothing to read and stays correct as long as a
-- group's rows are contiguous. That contiguity is a form invariant the database cannot
-- enforce — moving one row out of its group makes the rendered groups interleave.

alter table public.recipe_ingredients
  add column group_label text check (group_label is null or length(trim(group_label)) > 0);

-- ---------------------------------------------------------------------------
-- recipe_steps: per-step asides
-- ---------------------------------------------------------------------------
-- Warnings belonging to one step ("don't stir, it'll break up") rather than to the recipe.

alter table public.recipe_steps
  add column note text check (note is null or length(trim(note)) > 0);

-- ---------------------------------------------------------------------------
-- recipe_images: close the ordering gap
-- ---------------------------------------------------------------------------
-- recipe_steps and recipe_ingredients have been unique on their ordering column since the
-- start. recipe_images was unique on (recipe_id, storage_path) instead, which stops the same
-- file being attached twice but says nothing about position. Combined with
-- `sort_order default 0`, inserting several images without setting it explicitly was the easy
-- path into two images sharing position 0 and rendering in an arbitrary, unstable order.
--
-- This constraint is NOT deferrable, so reordering a gallery by patching rows in place will
-- collide mid-statement. recipe_steps and recipe_ingredients escape that because save_recipe
-- replaces their whole set on every save; images are written incrementally as uploads land,
-- so the gallery editor will need either a deferrable constraint or the same whole-set
-- replace. Recorded in docs/known-issues.md, to be decided with the Storage work.

alter table public.recipe_images
  add constraint recipe_images_recipe_id_sort_order_key unique (recipe_id, sort_order);
