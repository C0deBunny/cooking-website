/**
 * Everything the app knows about where recipe photos live.
 *
 * No Supabase client here on purpose. `publicImageUrl` is the one storage operation that touches
 * no network — it is string concatenation — and `getPublicUrl()` would mean instantiating a
 * client inside server components to do it. Keeping this file client-free is what keeps the
 * cached reads in `lib/recipes/queries.ts` client-free too.
 *
 * The database stores a path inside the bucket, never a URL. That keeps the project id and the
 * CDN hostname out of the rows, so they survive a project move and the URL shape can change
 * without a data migration. This file is where the two are joined back together.
 */

export const IMAGE_BUCKET = "recipe-images";

/**
 * The single source for the path convention.
 *
 * The prefix is the part that might change — decision 5 chose a flat `recipes/` over a per-recipe
 * folder, and a future gallery or sweep could revisit it. The uuid and the extension are the
 * parts nobody touches. Stating the prefix once and building the regex from it is what stops the
 * builder and the validator from disagreeing: a change to one that silently breaks saves is
 * exactly the footgun a brand-new file has no excuse to ship with. Decision 44.
 *
 * Exported for `lib/images/sweep.ts`, which needs the folder to enumerate and needs to rejoin the
 * names `.list()` returns relative to it. Same reason as the regex: one definition, not three.
 */
export const PATH_PREFIX = "recipes/";

/** `recipes/<uuid>.webp`. Flat, and the uuid claims nothing about which recipe owns the file. */
export function buildImagePath() {
  return `${PATH_PREFIX}${crypto.randomUUID()}.webp`;
}

/**
 * The same convention, as a check.
 *
 * Used by `lib/recipes/schema.ts`, because a server action compiles to a public HTTP endpoint and
 * a posted path is no more trustworthy than a posted id. Built from `PATH_PREFIX` rather than
 * restating it.
 */
export const IMAGE_PATH_PATTERN = new RegExp(`^${PATH_PREFIX}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$`);

/**
 * A stored path → the URL that serves its bytes.
 *
 * The bucket is public (decision 6), so this needs no signing and no expiry logic, and both the
 * CDN and `next/image` can cache the result.
 *
 * The trailing-slash strip is not defensive tidying: a stray `/` on `NEXT_PUBLIC_SUPABASE_URL` in
 * `.env.local` yields `//storage/v1` and a 404 on every image, which reads as a storage problem
 * rather than as a one-character config typo. Decision 45.
 */
export function publicImageUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
