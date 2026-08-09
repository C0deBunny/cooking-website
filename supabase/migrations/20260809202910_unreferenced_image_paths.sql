-- The oracle behind the orphan sweep: given a list of paths from the `recipe-images` bucket,
-- answer which of them nothing in the database references.
--
-- Why this lives in SQL rather than in the caller: the alternative is to fetch both path columns
-- over PostgREST and subtract in JS, and that version's correctness depends on both reads being
-- *complete*. An incomplete read reports live files as unreferenced — and the caller deletes what
-- this answers. PostgREST's `max_rows` is a per-role setting nobody here has pinned, so the
-- completeness of a bulk read could not be established; asking the database about its own tables
-- in one round trip removes the question instead of answering it. Decision 2 of
-- docs/plans/orphan-image-sweep/decisions.md.
--
-- ⚠ THE ANTI-JOIN IS ONLY CORRECT WHILE `authenticated` CAN READ EVERY ROW OF BOTH TABLES.
--
-- This is `security invoker`, so it sees exactly what its caller sees — and a row the caller
-- cannot see is a reference this function does not find, which it then reports as "unreferenced".
-- The failure direction is deletion of live photos, not retention of dead ones. Today the two
-- SELECT policies for `authenticated` are unrestricted (`anon`'s are not — they are scoped to
-- published recipes, which is why execute is granted to `authenticated` only), so the answer is
-- the truth.
--
-- docs/permission-model.md contemplates per-account ownership as a rebuild path. **The day any
-- SELECT policy on recipe_images or recipe_steps grows a `where`, this function starts reporting
-- other people's live photos as garbage.** Whoever writes that policy has to come back here. The
-- sweep's 25-file cap is what bounds the damage in the meantime, not this comment.
--
-- A new column holding an image path — a gallery, a second photo per step — has the identical
-- effect and is quieter. That is the other reason this is one function in SQL sitting next to the
-- schema rather than a query spread through the caller.

create or replace function public.unreferenced_image_paths(paths text[])
returns text[]
language sql
-- `text[]`, not `setof text`, and the difference is not stylistic: a set-returning function is
-- rows to PostgREST and therefore subject to the same `max_rows` cap this design exists to escape.
-- A single array value cannot be truncated.
stable
-- security invoker, NOT definer — see the warning above, and save_recipe()'s own note. A definer
-- function would read past RLS and be *more* correct today, at the cost of a second path through
-- these tables that no policy governs. The permission model is worth more than that.
security invoker
-- Same convention as save_recipe(): every name inside is fully qualified, so nothing can be
-- shadowed to hijack what runs.
set search_path = ''
as $$
  select coalesce(array_agg(distinct candidate.path order by candidate.path), '{}'::text[])
  from unnest(paths) as candidate(path)
  where not exists (
    select 1 from public.recipe_images i where i.storage_path = candidate.path
  )
  and not exists (
    -- recipe_steps.image_path is nullable; `=` never matches null, so no null guard is needed.
    select 1 from public.recipe_steps s where s.image_path = candidate.path
  );
$$;

-- Functions are executable by `public` by default. An `anon` caller sees only published recipes'
-- image rows, so it would get back *more* paths than are truly unreferenced — the dangerous
-- direction. It cannot delete anything with the answer, since `anon` is granted nothing on
-- storage.objects, but there is no reason to publish the oracle.
revoke execute on function public.unreferenced_image_paths(text[]) from public;
revoke execute on function public.unreferenced_image_paths(text[]) from anon;
grant execute on function public.unreferenced_image_paths(text[]) to authenticated;
