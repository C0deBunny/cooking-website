-- Remove ingredient groups entirely — the column, the value save_recipe() reads out of the
-- payload, and by extension the contiguity rule the zod schema enforced on top of them.
--
-- Why the whole feature and not just the input: keeping an unwritten column means save_recipe()
-- keeps reading a key nothing sends, RecipeArticle keeps a grouping pass that always yields one
-- group, and the zod contiguity refine keeps guarding an invariant nothing can violate — three
-- pieces of machinery maintained for a feature that is gone.
--
-- This supersedes decision 7 of docs/plans/recipe-schema-redesign/decisions.md, which chose a
-- denormalized group_label over an ingredient_groups table. That entry stays as written and
-- carries a pointer forward; the full reasoning here is decision 3 of
-- docs/plans/admin-create-wizard/decisions.md.

-- ---------------------------------------------------------------------------
-- Gate — first, so nothing below runs if it fires
-- ---------------------------------------------------------------------------
-- Dropping a column is irreversible and this project has no drift detection: Docker is
-- unavailable, so `db diff`, `db pull` and `db dump` all fail, and `db push` will drop a
-- populated column without a word. The plan called for running the count by hand in the SQL
-- editor before pushing. It was run and returned 0 — but a human step that has to be remembered
-- is not a guard, so it is written into the migration where it cannot be skipped.
--
-- Deliberately before the two statements that follow. Supabase applies each migration file in a
-- transaction, so a raise would roll the whole file back anyway — but ordering it first means
-- even an unwrapped replay stops before it has destroyed anything.

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.recipe_ingredients
  where group_label is not null;

  if v_count > 0 then
    raise exception
      'Refusing to drop recipe_ingredients.group_label: % row(s) still carry a group label. Those labels cannot be recovered after the drop — export them, or decide to lose them, before re-running this migration.',
      v_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_recipe() — the same function, minus group_label
-- ---------------------------------------------------------------------------
-- Replaced before the column is dropped so the function never references a column that is gone.
-- Everything else is what 20260801145324_save_recipe_function.sql installed: security invoker (a
-- definer function would run as its owner and bypass every RLS policy on these tables),
-- `set search_path = ''`, and the same grants. The only edits are the two group_label lines
-- removed from the ingredients insert.

create or replace function public.save_recipe(payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  -- Absent or null id means a new recipe.
  --
  -- Deliberately not `insert … on conflict (slug) do update`: that would make slug the
  -- recipe's identity, so renaming one would fork a second recipe and orphan the first.
  -- Here slug is ordinary data and a rename is just an update.
  --
  -- Every cast is wrapped in nullif(…, '') because an untouched form input arrives as an
  -- empty string, and ''::int raises rather than yielding null. zod normalises these too;
  -- this is the layer that holds when something other than the form calls in.
  if payload ->> 'id' is not null then
    v_id := (payload ->> 'id')::bigint;

    update public.recipes set
      slug         = payload ->> 'slug',
      title        = payload ->> 'title',
      description  = nullif(trim(payload ->> 'description'), ''),
      difficulty   = nullif(payload ->> 'difficulty', '')::public.recipe_difficulty,
      prep_minutes = nullif(payload ->> 'prep_minutes', '')::int,
      cook_minutes = nullif(payload ->> 'cook_minutes', '')::int,
      servings     = nullif(payload ->> 'servings', '')::int,
      notes        = nullif(trim(payload ->> 'notes'), ''),
      published    = coalesce(nullif(payload ->> 'published', '')::boolean, false)
    where id = v_id;

    -- RLS can make an update match zero rows without raising anything, so a missing or
    -- unwritable recipe has to be caught rather than assumed away.
    if not found then
      raise exception 'Recipe % not found or not writable', v_id
        using errcode = 'no_data_found';
    end if;
  else
    insert into public.recipes (slug, title, description, difficulty, prep_minutes, cook_minutes, servings, notes, published)
    values (
      payload ->> 'slug',
      payload ->> 'title',
      nullif(trim(payload ->> 'description'), ''),
      nullif(payload ->> 'difficulty', '')::public.recipe_difficulty,
      nullif(payload ->> 'prep_minutes', '')::int,
      nullif(payload ->> 'cook_minutes', '')::int,
      nullif(payload ->> 'servings', '')::int,
      nullif(trim(payload ->> 'notes'), ''),
      coalesce(nullif(payload ->> 'published', '')::boolean, false)
    )
    returning id into v_id;
  end if;

  -- Children are replaced wholesale rather than diffed. `with ordinality` turns the array's
  -- own order into the ordering column, so the client never sends positions and a reorder is
  -- simply a differently-ordered array. This is also why the non-deferrable unique
  -- constraints never fire: the old rows are gone before the new ones land.
  delete from public.recipe_ingredients where recipe_id = v_id;

  insert into public.recipe_ingredients (recipe_id, sort_order, name, amount, unit)
  select
    v_id,
    ord - 1, -- 0-based, matching the `sort_order >= 0` check
    item ->> 'name',
    nullif(item ->> 'amount', '')::numeric,
    nullif(trim(item ->> 'unit'), '')
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb))
    with ordinality as t(item, ord);

  delete from public.recipe_steps where recipe_id = v_id;

  insert into public.recipe_steps (recipe_id, step_number, instruction, note, image_path)
  select
    v_id,
    ord, -- 1-based, matching the `step_number > 0` check
    item ->> 'instruction',
    nullif(trim(item ->> 'note'), ''),
    nullif(trim(item ->> 'image_path'), '')
  from jsonb_array_elements(coalesce(payload -> 'steps', '[]'::jsonb))
    with ordinality as t(item, ord);

  -- Images and tags are intentionally absent. No Storage bucket exists yet
  -- (docs/image-storage.md) and tags are being designed in their own session. Both extend
  -- this by reading one more key off the payload, which is exactly why the signature is a
  -- single jsonb argument rather than a parameter per column — adding `payload -> 'tag_ids'`
  -- later breaks no existing caller.

  return v_id;
end;
$$;

-- `create or replace` keeps the existing grants, but they are restated for the same reason the
-- original migration stated them rather than relying on defaults: this file should describe the
-- function's whole security posture instead of leaving half of it inherited from a file three
-- migrations back.
revoke execute on function public.save_recipe(jsonb) from public;
revoke execute on function public.save_recipe(jsonb) from anon;
grant execute on function public.save_recipe(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- recipe_ingredients: drop the column
-- ---------------------------------------------------------------------------
-- Its check constraint goes with it. Nothing else references it — save_recipe() above is the
-- only writer, and the only reader was groupIngredients() in RecipeArticle, deleted in the same
-- commit. `npm run db:types` after this turns every remaining reader into a compile error.

alter table public.recipe_ingredients
  drop column group_label;
