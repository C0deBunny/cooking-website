// import lib
import { createClient } from "@/lib/supabase/browser-client";
import { buildImagePath, IMAGE_BUCKET } from "@/lib/supabase/storage";

/**
 * The photo pipeline: decode → crop → compress → upload → remove.
 *
 * ```
 * File  →  createImageBitmap(file, { imageOrientation: "from-image" })
 *       →  CropDialog, which returns { sx, sy, size } in source pixels
 *       →  OffscreenCanvas, min(1200, size) square
 *       →  drawImage(bitmap, sx, sy, size, size, 0, 0, out, out)
 *       →  convertToBlob({ type: "image/webp", quality: 0.82 })
 *       →  upload to recipes/<uuid>.webp
 * ```
 *
 * Client-only, and used by nothing outside the wizard, so it colocates with `draft.ts` rather
 * than becoming a fourth file in `lib/recipes/` — which CLAUDE.md restricts to queries, actions
 * and schema.
 *
 * Uploads go straight from the browser rather than through a server action. `browser-client.ts`
 * wraps `createBrowserClient`, which is cookie-backed — the same session `proxy.ts` refreshes —
 * so the request carries the signed-in JWT and meets the `authenticated` storage policies. (A
 * plain `createClient` holding its session in localStorage would upload as `anon` and fail with
 * an RLS error that reads exactly like a broken policy.) It also sidesteps Vercel's 4.5MB cap on
 * a server action's request body, which a single phone photo clears.
 */

/** The crop window, in source-image pixels. `CropDialog` computes it; this file consumes it. */
export type CropRect = { sx: number; sy: number; size: number };

/** Large enough for the article's 768px hero on a 2× screen, small enough to stay under 2MB. */
const MAX_OUTPUT = 1200;

/**
 * Decode before the dialog opens, and paint the dialog from *this* bitmap.
 *
 * `imageOrientation: "from-image"` is load-bearing. A portrait phone photo carries its rotation
 * as EXIF metadata rather than in the pixels; an `<img>` applies it automatically, and
 * `createImageBitmap` does not unless asked. Paint the dialog from an object URL on the raw
 * `File` and confirm the crop against a decoded bitmap and the output comes back rotated *and*
 * offset — the rectangle was measured against one orientation and applied to another. One decode,
 * used for both, removes the mismatch rather than compensating for it.
 *
 * Throws on a format the browser cannot decode — HEIC, in practice, which iPhones shoot and which
 * neither Chrome nor Firefox reads. That happens *before* anything is attached, which is why the
 * caller surfaces it as a toast rather than as the field's error state (decision 30).
 */
export async function decodeImage(file: File) {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Crop, compress and upload. Returns the stored path.
 *
 * `previousPath` makes this the replace path too, and the order is the whole decision: upload the
 * new file **first**, then remove the old one best-effort, then hand back the new path. A failure
 * at the upload leaves the original photo and its path untouched; a failure at the remove costs
 * one orphaned file. The intuitive order — remove, then upload — loses the user's photo when the
 * re-upload fails, and leaves the draft holding a path to nothing. Every failure here falls
 * toward wasted bytes and never toward a broken reference. Decision 24.
 */
export async function uploadCrop(bitmap: ImageBitmap, rect: CropRect, previousPath?: string) {
  const output = Math.min(MAX_OUTPUT, rect.size);
  const canvas = new OffscreenCanvas(output, output);
  const context = canvas.getContext("2d");

  if (!context) throw new Error("This browser could not prepare the photo for upload.");

  // The 9-argument form: source rectangle in, destination rectangle out. The 5-argument form
  // would scale the whole image into the square and squash it.
  context.drawImage(bitmap, rect.sx, rect.sy, rect.size, rect.size, 0, 0, output, output);

  // ⚠ `type` here is what the bucket's MIME allowlist checks, and this is not obvious. For a Blob
  // body supabase-js wraps it in FormData and never sets a content-type header at all, so the
  // `contentType` upload option below is silently ignored — the MIME the bucket sees comes from
  // the multipart part, which is `blob.type`. Passing `contentType: "image/webp"` looks like a
  // guard and is a no-op; dropping this argument (or switching to `canvas.toBlob` with a typo)
  // produces a blob the bucket rejects with an opaque 400 that reads exactly like a missing
  // policy. Decision 32.
  //
  // `convertToBlob` is an OffscreenCanvas method — `HTMLCanvasElement.toBlob` is the other API
  // and is callback-based.
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });

  const path = buildImagePath();
  const supabase = createClient();

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    // A year, not the library's one-hour default. Paths are uuids and a replace mints a new one,
    // so the object at a path is immutable — an hour is not the CDN caching a public bucket was
    // chosen to get. Decision 32.
    cacheControl: "31536000",
  });

  if (error) throw new Error(uploadErrorMessage(error));

  if (previousPath) await removeImage(previousPath);

  return path;
}

/**
 * Delete one file. Never throws.
 *
 * Callers clear the draft field whether or not this succeeds: an orphaned file is cheap, while a
 * draft still holding a path the user just deleted saves a recipe with an image they removed.
 * Same rule as the replacement ordering above.
 *
 * A silent zero-row result is possible and is the fingerprint of a missing `select` policy on
 * `storage.objects` — `.remove()` reads the rows it deletes, so without that grant it removes
 * nothing and still answers `{ data: [], error: null }`. The migration grants it; the smoke test
 * in the plan's Verification section is what proves it. Decision 33.
 */
export async function removeImage(path: string) {
  try {
    const supabase = createClient();
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  } catch {
    // Deliberately swallowed — see above.
  }
}

/**
 * Storage failures → something a cook can act on.
 *
 * The `reason` this produces is rendered twice: on the field itself and in Review's alert block.
 * Routing both through one helper is the same rule `slugTakenMessage` follows — the same failure
 * must not be worded two ways depending on where it is noticed.
 *
 * Without this an expired session renders as "new row violates row-level security policy" on the
 * Review panel of a recipe site. The fallback carries the raw message, so a mapping that goes
 * stale against Supabase's wording degrades to a wordy message rather than to silence.
 * Decision 46.
 */
export function uploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = Number((error as { statusCode?: string | number })?.statusCode ?? NaN);
  const lower = message.toLowerCase();

  if (status === 401 || status === 403 || lower.includes("row-level security") || lower.includes("jwt")) {
    return "Your sign-in expired while the photo was uploading. Sign in again, then attach it once more.";
  }

  if (status === 413 || lower.includes("maximum allowed size") || lower.includes("payload too large")) {
    return "That photo is still too large after compression. Try a smaller crop or a shorter side.";
  }

  if (lower.includes("mime type") || lower.includes("not supported")) {
    return "That file was not accepted. Photos have to end up as webp — try a JPEG or PNG original.";
  }

  return `The photo could not be uploaded: ${message}`;
}
