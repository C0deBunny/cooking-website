/**
 * Collects the files in the `recipe-images` bucket that nothing references.
 *
 * Photos are uploaded the moment they are cropped, so a file exists before the recipe that names
 * it does — and three things leave one behind: an abandoned wizard tab, a replaced image once
 * editing exists, and a silent storage failure inside `deleteRecipe`. This sweeps them up from
 * inside the two actions that can have caused them, rather than from a screen someone has to
 * remember to visit. Full reasoning: docs/plans/orphan-image-sweep/.
 *
 * ⚠ **This file is deliberately NOT `"use server"`, and nothing here may be re-exported from a
 * file that is.** Every export from a `"use server"` file compiles to a public HTTP endpoint, and
 * this one deletes files. Not creating the endpoint beats defending it.
 *
 * That is why `lib/images/` is the one folder under `lib/` without CLAUDE.md's
 * queries/actions/schema trio: this is neither a read nor client-callable, and the convention has
 * no slot for an internal server-side write. Inventing a fourth file kind silently would be worse
 * than saying so here. Decision 7.
 *
 * It is called from `after()`, so it runs once the response is flushed — the owner waits for
 * nothing — and it runs inside the request's auth context, which is the whole reason it needs no
 * service-role key. Decision 1.
 */

// import lib
import { createClient } from "@/lib/supabase/server-client";
import { IMAGE_BUCKET, IMAGE_PATH_PATTERN, PATH_PREFIX } from "@/lib/supabase/storage";

/**
 * Nothing younger than this is a candidate, however unreferenced it looks.
 *
 * This is the only thing standing between a second open wizard tab and deletion: save a recipe in
 * one tab while another holds a half-filled wizard whose photos are already uploaded, and those
 * files are unreferenced but very much alive. Delete them and the second tab publishes a recipe
 * that renders broken images — the one failure direction the whole storage design forbids.
 *
 * Seven days rather than the 24 hours known issue 4 guessed at. The floor's only cost is how long
 * an orphan lingers, and nothing observes that now the sweep is automatic; when one side of a
 * trade is unobserved and the other is a broken live recipe, buy the margin. Decision 4.
 *
 * Temporarily setting this to `0` is step two of the probe in docs/image-storage.md — which is
 * most of why it is a named constant.
 */
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The most files one run may delete.
 *
 * Not a performance knob. It bounds the damage if the anti-join ever returns a wrong answer — a
 * narrowed SELECT policy or a new image column it does not know about would both report live
 * paths as unreferenced — and it leaves the survivors as evidence to diagnose from. In normal
 * operation the list is 0–3 and this is never felt, so **hitting it is itself a signal** and is
 * logged as one. Decision 8.
 */
const MAX_DELETIONS_PER_RUN = 25;

/** `.list()` pages; 100 is the API's own default page size. */
const PAGE_SIZE = 100;

/** Enough pages for far more objects than this bucket will ever hold. A loop guard, not a limit. */
const MAX_PAGES = 100;

/** Every log line starts with this, because nothing but a human in Vercel's log view reads them. */
const LOG_PREFIX = "[orphan-sweep]";

/**
 * Lists the bucket, asks Postgres which of those paths nothing references, and removes the oldest
 * of them.
 *
 * Four independent filters stand between "every object in the bucket" and "files this may delete",
 * and **each fails toward keeping a file**: full enumeration, the path-shape gate, the age floor,
 * and the anti-join. Resolves to the paths actually removed, which is only ever read by the log
 * line below — callers pass this to `after()` and ignore it.
 *
 * Never throws. The response was flushed before this ran, so there is nobody to report to, and an
 * unhandled rejection inside `after()` can surface as a platform-level error against a request the
 * user watched succeed. Decision 6 — which is also why a persistently broken sweep is silent, and
 * why the probe in docs/image-storage.md exists.
 */
export async function sweepOrphans(): Promise<string[]> {
  try {
    const supabase = await createClient();

    // 1. Enumerate. Full enumeration is unavoidable: in steady state the *oldest* objects are old
    //    recipes' covers, referenced forever, so a "check the oldest page only" shortcut would
    //    never reach a real orphan. Paged by offset, in the API's default name order — stable,
    //    unlike created_at, which can tie.
    const candidates: { path: string; createdAt: number }[] = [];
    const now = Date.now();

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list(PATH_PREFIX.replace(/\/$/, ""), { limit: PAGE_SIZE, offset: page * PAGE_SIZE });

      if (error) {
        console.error(`${LOG_PREFIX} could not list the bucket: ${error.message}`);
        return [];
      }

      if (!data || data.length === 0) break;

      for (const object of data) {
        // `.list()` returns names relative to the folder, so the prefix goes back on before
        // anything compares or deletes — these are the paths the database stores.
        const path = `${PATH_PREFIX}${object.name}`;

        // 2. Gate on the path convention. This buys a stronger property than filtering
        //    `.emptyFolderPlaceholder` by name would: the sweep can only ever delete files shaped
        //    exactly like the ones this app creates, so a placeholder, a file put there by hand,
        //    or a future prefix is invisible to it. Decision 11.
        if (!IMAGE_PATH_PATTERN.test(path)) continue;

        // 3. The age floor. A missing or unparseable created_at counts as too young — not knowing
        //    how old a file is has to mean keeping it.
        const createdAt = Date.parse(object.created_at ?? "");

        if (Number.isNaN(createdAt) || now - createdAt < MIN_AGE_MS) continue;

        candidates.push({ path, createdAt });
      }

      if (data.length < PAGE_SIZE) break;
    }

    if (candidates.length === 0) {
      console.log(`${LOG_PREFIX} no candidates old enough to consider`);
      return [];
    }

    // 4. Ask Postgres. The database answers about its own tables in one round trip, so a partial
    //    view of them cannot exist — which the JS set-diff this replaced could not promise, and
    //    whose incomplete read would have deleted live files. Decision 2.
    const { data: unreferenced, error } = await supabase.rpc("unreferenced_image_paths", { paths: candidates.map((candidate) => candidate.path) });

    if (error) {
      console.error(`${LOG_PREFIX} the anti-join failed, deleting nothing: ${error.message}`);
      return [];
    }

    const orphans = unreferenced ?? [];

    if (orphans.length === 0) {
      console.log(`${LOG_PREFIX} ${candidates.length} candidates, 0 unreferenced`);
      return [];
    }

    // Oldest first, so a backlog drains in the order the files were abandoned and the survivors of
    // a capped run are the newest — the ones most likely to still matter.
    const unreferencedPaths = new Set(orphans);
    const doomed = candidates
      .filter((candidate) => unreferencedPaths.has(candidate.path))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, MAX_DELETIONS_PER_RUN)
      .map((candidate) => candidate.path);

    const { data: removed, error: removeError } = await supabase.storage.from(IMAGE_BUCKET).remove(doomed);

    if (removeError) {
      console.error(`${LOG_PREFIX} removing ${doomed.length} file(s) failed: ${removeError.message}`);
      return [];
    }

    // The cap is called out by name because in normal operation it is unreachable — 0–3 orphans
    // against a limit of 25 — so a run that hits it is either a genuine backlog or the anti-join
    // having gone wrong, and both want looking at.
    const capped = orphans.length > MAX_DELETIONS_PER_RUN ? ` CAP HIT — ${orphans.length - doomed.length} left for the next run;` : "";

    // Asked-for **and** returned, not just asked-for. A remove that RLS refuses comes back
    // `{ data: [], error: null }`, so a line reading "removed 3" off `doomed` would report success
    // over a `select` policy on storage.objects that had regressed and deleted nothing. That is a
    // real documented failure (docs/image-storage.md); printing both numbers makes `3/0` say it.
    console.log(`${LOG_PREFIX} removed ${removed?.length ?? 0}/${doomed.length} of ${orphans.length} unreferenced file(s), from ${candidates.length} candidates;${capped} ${doomed.join(", ")}`);

    return doomed;
  } catch (cause) {
    console.error(`${LOG_PREFIX} threw`, cause);
    return [];
  }
}
