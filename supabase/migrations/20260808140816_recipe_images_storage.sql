-- The Storage half of the permission model: one bucket for recipe photos, and the policies that
-- say who may write to it.
--
-- Why this is a migration and not a click in the dashboard, or a block in supabase/config.toml:
-- migrations reach the hosted project *and* every throwaway database the CLI builds, from one
-- source. `config.toml` configures a local stack this project never starts, so declaring the
-- bucket there as well would be a second definition that only that stack reads — local and hosted
-- free to disagree on public, size limit and MIME list with nothing comparing them. A bucket made
-- by clicking is invisible to migration history in exactly the way CLAUDE.md's Table Editor rule
-- warns about. See decision 42 of docs/plans/recipe-images/decisions.md.
--
-- ⚠ Neither half of this file is covered by `npm run db:diff`. The bucket is a *row* in
-- storage.buckets — data, not schema — so no diff engine will ever see it. The policies are
-- visible only under `npm run db:diff:storage`, which runs the migra engine on purpose; the
-- default pg-delta engine prints "No schema changes found" over storage drift it cannot see.
-- Decision 43, and docs/known-issues.md.

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
-- public = true: object bytes are served over /object/public/…, cacheable by the CDN and by
-- next/image with no signing and no expiry logic. A personal recipe site is public content. The
-- accepted cost is that an *unpublished* recipe's photos are fetchable by anyone holding the URL
-- even though RLS hides the row — uuid paths make that unguessable rather than protected.
-- Decision 6.
--
-- The MIME allowlist is one entry on purpose. Everything leaving the browser is already webp
-- (decision 3), so the bucket physically rejects anything that bypassed the compression pipeline
-- — and nothing else enforces that pipeline, which lives in one client-side file. Decision 7.
--
-- ⚠ The MIME the bucket checks comes from the uploaded blob's own `type`, not from the
-- `contentType` option supabase-js accepts. See the comment at the `convertToBlob` call in
-- app/admin/_components/recipe-wizard/upload.ts — decision 32.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 2097152, array['image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------
-- storage.objects is an ordinary table with its own RLS, and the bucket being public grants
-- nothing on it. Every policy here is scoped to this bucket by `bucket_id` — without that they
-- would apply to every bucket the project ever gains.
--
-- Granted to `authenticated` and to nothing else, mirroring the four recipe tables: there are two
-- roles, not three, and every logged-in account is the owner. `anon` gets nothing, because
-- rendering does not need it — the public URL serves bytes without touching this table.
--
-- Each one is dropped first, so this file survives a replay in one piece. `create policy` has no
-- `if not exists` form and raises 42710 on a name that already exists — which would roll the
-- bucket upsert above back with it, since the CLI wraps the file in a transaction. The upsert is
-- deliberately re-runnable; without these drops the rest of the file would not be.

-- ⚠ SELECT is required, not defensive, and this was verified rather than reasoned.
--
-- storage-api runs the user-facing delete **as the caller**, reaching
-- `delete from storage.objects where bucket_id = $1 and name = any($2) returning *` — and
-- Postgres applies SELECT policies to that statement, because its where clause reads columns and
-- it carries `returning`. Probed on a throwaway table: with a permissive delete policy and no
-- select policy, the delete affects **zero rows**.
--
-- So without this grant the wizard's ✕ removes neither the row nor the file, `.remove()` still
-- returns `{ data: [], error: null }`, and — since a storage failure is deliberately silent by
-- decision 11 — nothing would ever say so. The orphan sweep's `.list()` needs the same grant.
-- Decision 33.
drop policy if exists "authenticated reads recipe images" on storage.objects;

create policy "authenticated reads recipe images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recipe-images');

drop policy if exists "authenticated uploads recipe images" on storage.objects;

create policy "authenticated uploads recipe images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');

drop policy if exists "authenticated updates recipe images" on storage.objects;

create policy "authenticated updates recipe images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-images')
  with check (bucket_id = 'recipe-images');

drop policy if exists "authenticated deletes recipe images" on storage.objects;

create policy "authenticated deletes recipe images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-images');
