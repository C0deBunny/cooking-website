-- Drop recipe_images.alt.
--
-- Alt text is not deferred, it is decided: both placements pass `alt=""`. Under the hero the
-- title is overlaid on the photo, and a step photo sits directly beneath the instruction that
-- describes it — in both cases the accessible name is already adjacent, and a duplicate would be
-- noise. next/image still requires the prop, so this is a decision about *where the string comes
-- from*, not whether one exists. The column's own comment in the initial schema made the same
-- argument before any of this existed. Decision 27 of docs/plans/recipe-images/decisions.md.
--
-- Left in place it would carry null forever, and a reader comparing the schema to the code would
-- assume the app had simply forgotten to write it.

-- ---------------------------------------------------------------------------
-- Gate — first, so nothing below runs if it fires
-- ---------------------------------------------------------------------------
-- Nothing has ever written this column, so this passes trivially — which is the point. The gate
-- is what makes that a checked fact rather than an assumed one, per docs/database-workflow.md.
-- Precedent: 20260801190718_remove_ingredient_groups.sql drops group_label the same way.
--
-- Deliberately before the drop. Supabase applies each migration file in a transaction, so a raise
-- would roll the whole file back anyway — but ordering it first means even an unwrapped replay
-- stops before it has destroyed anything.

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.recipe_images
  where alt is not null;

  if v_count > 0 then
    raise exception
      'Refusing to drop recipe_images.alt: % row(s) still carry alt text. That text cannot be recovered after the drop — export it, or decide to lose it, before re-running this migration.',
      v_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The drop
-- ---------------------------------------------------------------------------
-- save_recipe() never wrote this column and the block added in the neighbouring migration never
-- will — do not add it "for symmetry" with the ingredients and steps blocks. `npm run db:types`
-- after this turns any reader that appears later into a compile error.

alter table public.recipe_images
  drop column alt;
