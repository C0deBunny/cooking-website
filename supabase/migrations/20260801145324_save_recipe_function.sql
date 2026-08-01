-- The recipe write path, as one function so that it is one transaction.
--
-- Why this exists at all: Supabase JS issues every statement as its own HTTP request, and
-- therefore its own transaction. The form saves a recipe wholesale, which means replacing its
-- children — and a `delete` that succeeds followed by an `insert` that fails would leave a
-- recipe with no steps at all. Inserting before deleting is not an escape either, because
-- `unique (recipe_id, step_number)` makes the new rows collide with the old ones still
-- present. Inside a function the whole thing commits or none of it does.
--
-- jsonb is the transport, not the storage. Nothing is kept as a blob; every row this produces
-- is an ordinary typed row with its checks and foreign keys intact.

create or replace function public.save_recipe(payload jsonb)
returns bigint
language plpgsql
-- security invoker, NOT definer. A definer function runs as its owner and bypasses RLS
-- entirely, which would be a write path straight past every policy on these tables. invoker
-- keeps the caller's identity, so the existing "authenticated writes …" policies are still
-- what decides whether any of this is allowed. Most Supabase RPC examples online use definer;
-- copying one here would quietly undo the permission model.
security invoker
-- Same convention as set_updated_at(): forces every name inside to be fully qualified, so
-- nothing can be shadowed to hijack what runs.
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

  insert into public.recipe_ingredients (recipe_id, sort_order, group_label, name, amount, unit)
  select
    v_id,
    ord - 1, -- 0-based, matching the `sort_order >= 0` check
    nullif(trim(item ->> 'group_label'), ''),
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

-- Functions are executable by `public` by default, which would leave this callable by anon.
-- RLS would still refuse the writes, so this is defence in depth rather than the only guard —
-- but an anonymous visitor has no business being able to invoke it at all.
revoke execute on function public.save_recipe(jsonb) from public;
revoke execute on function public.save_recipe(jsonb) from anon;
grant execute on function public.save_recipe(jsonb) to authenticated;
