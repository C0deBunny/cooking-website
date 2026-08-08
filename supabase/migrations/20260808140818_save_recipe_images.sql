-- save_recipe(), plus the cover image.
--
-- This is the extension the function's own closing comment anticipated: one more key read off the
-- payload, no new parameter, no caller broken — exactly what CLAUDE.md mandates for this
-- function. `recipe_steps.image_path` was already being written, so step photos needed no SQL
-- change at all; only the cover did.
--
-- ⚠ `create or replace` restates the **entire body**, so everything below is
-- 20260801190718_remove_ingredient_groups.sql's version verbatim plus the images block. A copy
-- that quietly loses the `if not found` guard turns an unwritable recipe back into a silent
-- no-op.
--
-- There is no ordering constraint against the `alt` drop beside this file. The new block never
-- writes `alt` and the function does not otherwise read recipe_images, so either order applies
-- cleanly. What is *not* optional: never add `alt` here for symmetry with the ingredients and
-- steps blocks — the column is gone. Decision 34.

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

  -- Images, the new block. Shaped as a list even though the wizard writes exactly one row
  -- flagged primary: recipe_images already supports many rows with sort_order and a partial
  -- unique index allowing one primary, so a gallery later is a UI change rather than a payload
  -- change. Replaced wholesale like the other children, for the same reason.
  --
  -- Note what is absent: `alt`. The column is dropped in the migration beside this one, and the
  -- accessible name comes from the adjacent title or instruction instead (decision 27).
  --
  -- Deleting these rows does **not** delete the files they name — Postgres has no idea the
  -- bucket exists. Replacing a recipe's cover through this function therefore orphans the old
  -- object; see docs/image-storage.md and the sweep recorded in docs/known-issues.md.
  delete from public.recipe_images where recipe_id = v_id;

  insert into public.recipe_images (recipe_id, sort_order, storage_path, is_primary)
  select
    v_id,
    ord - 1, -- 0-based, matching recipe_ingredients rather than recipe_steps
    item ->> 'storage_path',
    -- nullif for the same reason every other cast in this function has one: an empty string is
    -- what an untouched form field sends, and ''::boolean raises rather than yielding null.
    -- Unreachable from toPayload(), which sends a real JSON boolean — exactly as unreachable as
    -- it is for `published` above, which is wrapped anyway.
    --
    -- ⚠ An item that omits the flag writes a row with is_primary false, and such a row renders
    -- **nowhere**: getRecipes() filters the embed on is_primary and toRecipeView() resolves the
    -- primary, so the file exists, the row exists, and no surface shows either. Nothing raises.
    -- Safe today because toPayload() sends at most one image and always flags it — but a gallery
    -- that forgets to flag one would fail this way silently. Do not default this to `ord = 1`
    -- without deciding that a caller's omission should be overruled here rather than reported.
    coalesce(nullif(item ->> 'is_primary', '')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'images', '[]'::jsonb))
    with ordinality as t(item, ord);

  -- Tags are still intentionally absent — they are being designed in their own session, and they
  -- extend this the same way this block just did: one more key off the payload, which is why the
  -- signature is a single jsonb argument rather than a parameter per column.

  return v_id;
end;
$$;

-- `create or replace` keeps the existing grants, but they are restated for the same reason the
-- original migration stated them rather than relying on defaults: this file should describe the
-- function's whole security posture instead of leaving half of it inherited from a file four
-- migrations back. It also matters if the signature is ever changed — that makes this a CREATE,
-- and Postgres hands `execute` back to `public` by default, restoring anon's ability to call it
-- while the comment claiming otherwise stays in place.
revoke execute on function public.save_recipe(jsonb) from public;
revoke execute on function public.save_recipe(jsonb) from anon;
grant execute on function public.save_recipe(jsonb) to authenticated;
