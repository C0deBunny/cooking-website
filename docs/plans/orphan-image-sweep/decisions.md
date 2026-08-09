# Decisions: Orphan image sweep

## 1. Piggyback on writes via `after()` rather than schedule a job

- **Date:** 2026-08-09
- **Considered:** an admin page with a manual button · `after()` on the actions that leak ·
  Vercel Cron hitting a route handler · a Supabase Edge Function on a schedule · `pg_cron` in SQL
- **Chosen:** `after()` on the actions. It runs once the response is flushed, so the owner waits for
  nothing, and it runs **inside the request's auth context** — the sweep authenticates as the signed-in
  owner, exactly as `deleteRecipe`'s own file removal already does.
- **Why not a scheduled job:** every scheduled option runs with nobody signed in, and `anon` is granted
  nothing on `storage.objects`. All three therefore need a service-role key, which `.env.example` and
  `CLAUDE.md` both forbid without a deliberate discussion — and with `using (true)` write policies and
  no `user_id` column anywhere, that key is unrestricted write access to the whole database. Adding the
  project's single largest security liability to collect a handful of stray files a year is the wrong
  trade. If an unattended sweep is ever genuinely wanted, the Edge Function is the shape to revisit,
  because the key would live in Supabase rather than in Vercel's environment.
- **Why not `pg_cron` in SQL:** deleting from `storage.objects` removes Postgres's record of the object
  without removing the file from the backing store, converting visible orphans into invisible ones.
  Would need probing before being trusted either way.
- **Trade-off:** nothing collects anything if the owner never writes again. Accepted — the trigger is
  the same event that creates the leak.

## 2. Let Postgres answer the anti-join instead of diffing in JS

- **Date:** 2026-08-09
- **Considered:** fetch both path columns and subtract in JS · the same, with an explicit `.range()`
  loop over each table · send the candidate paths to a SQL function and let it answer
- **Chosen:** the SQL function. The database answers about its own tables in a single round trip, so a
  partial view of them cannot exist, and the row-cap question stops mattering.
- **Why not the JS set-diff:** its correctness depends on both reads being complete, and an incomplete
  read fails toward _deleting live files_ — the exact direction the rest of this codebase is built to
  avoid. That is not hypothetical: `supabase/config.toml` sets `max_rows = 1000`, hosted Supabase has
  the same knob defaulting to the same value, and no `pgrst.db_max_rows` override exists on any role,
  so the effective hosted limit could not be established. A future gallery column nobody adds to the
  query has the identical effect and is quieter.
- **Why not the paginated set-diff:** it closes the row cap but leaves the safety in caller code that
  has to be got right, and still breaks silently on a new image column.
- **Trade-off:** a migration, a regenerated `types/database.ts`, and one more RPC on the public
  PostgREST surface — mitigated by revoking execute from `anon` and `public`. Follows the `save_recipe`
  precedent of putting the write-adjacent logic in SQL.

## 3. Trigger on `saveRecipe` and `deleteRecipe`, not on every mutating action

- **Date:** 2026-08-09
- **Considered:** `saveRecipe` only · `saveRecipe` and `deleteRecipe` · every mutating action
- **Chosen:** both of the two that can leak. `saveRecipe` covers the abandoned wizard and, later, the
  replaced image. `deleteRecipe` removes its own files best-effort and **never reports a failure** —
  that silent failure is one of the three leak sources known issue 4 lists, and it is the one event
  that knows a leak may have just happened.
- **Why not every action:** `togglePublished` creates no files and touches no paths, so sweeping on it
  would run the whole pipeline on a click that cannot possibly have leaked anything.
- **Trade-off:** one extra `after()` call.

## 4. A 7-day age floor, not 24 hours

- **Date:** 2026-08-09
- **Considered:** 1 hour · 24 hours, as guessed in known issue 4 · 7 days
- **Chosen:** 7 days. The floor's only cost is how long an orphan lingers, and nothing observes that —
  the sweep is automatic now. Its benefit is preventing the one catastrophic case. When one side of a
  trade is unobserved and the other is a broken live recipe, buy the margin.
- **The case it exists for:** the owner saves a recipe in one tab while a second tab holds a half-filled
  wizard whose photos are already uploaded. Those files are unreferenced but very much alive. A floor
  short enough to miss that deletes them, the second tab then publishes, and a live recipe renders
  broken images — the failure direction the whole storage design forbids. A tab that sleeps over a
  weekend clears 24 hours easily.
- **Trade-off:** with the bucket's oldest object dated 2026-08-08, nothing is collected until roughly
  2026-08-15. That is what makes the probe in decision 10 the only pre-flight evidence available.

## 5. No admin page — console logging only

- **Date:** 2026-08-09
- **Considered:** a read-only page showing the count and paths · the same page plus a manual sweep
  button · no page at all
- **Chosen:** no page. The automation is the trigger, so a button would be a second call site for the
  same delete, and a count nobody has a reason to open is a page nobody opens.
- **Why not the page:** it was the recommended option, because a number that only ever grows is a broken
  sweep visible at a glance, and without it there is no ambient signal at all. Rejected as more surface
  than a personal site's stray files justify.
- **Trade-off:** a working sweep and one that throws on its first line look identical from outside.
  Bought back with decision 10's probe, and it removes the plan's original shared `findOrphans()` — with
  one caller there is nothing to share, which is what reopened decision 7.

## 6. Swallow sweep failures and log them

- **Date:** 2026-08-09
- **Considered:** let it throw · catch, log, continue
- **Chosen:** catch and log. The response has already been flushed by the time this runs, so there is
  literally no one to report to, and an unhandled throw inside `after()` can surface as a platform-level
  error against a request the user watched succeed.
- **Trade-off:** a persistently failing sweep is silent. Same mitigation as decision 5 — the probe.

## 7. Keep the sweep out of a `"use server"` file

- **Date:** 2026-08-09
- **Considered:** `lib/images/actions.ts` following the three-file convention · a module-private helper
  inside `lib/recipes/actions.ts` · `lib/images/sweep.ts` as a plain module
- **Chosen:** `lib/images/sweep.ts`, plain, imported directly by `lib/recipes/actions.ts`. **Every export
  from a `"use server"` file compiles to a public HTTP endpoint**, and this one deletes files. Not
  creating the endpoint beats defending it.
- **Why not follow the convention literally:** `CLAUDE.md`'s `queries.ts` / `actions.ts` / `schema.ts`
  shape has no slot for an internal server-side write — this is neither a read nor client-callable.
  Departing from it needs to be visible, hence the note in `CLAUDE.md` and the comment in the file
  itself. Inventing a fourth file kind silently would be worse than either.
- **Why not private inside `lib/recipes/actions.ts`:** it buries storage-sweep logic in the recipes
  domain, and a private helper in a `"use server"` file is one keystroke from becoming an endpoint.
- **Trade-off:** the first folder under `lib/` that does not have the standard three files.

## 8. Cap each run at 25 files, oldest first

- **Date:** 2026-08-09
- **Considered:** no cap · a fixed per-run cap
- **Chosen:** 25 per run. Not a performance knob — it bounds the damage when the anti-join returns a
  wrong answer, and leaves the survivors as evidence to diagnose from. In normal operation the bucket
  gains a handful of strays a year and the hook fires on every write, so the orphan list is essentially
  always 0–3 and the cap is never felt.
- **Why not no cap:** one wrong answer would empty the bucket in a single save, with nothing left to
  work backwards from.
- **Trade-off:** a genuine backlog drains 25 per write rather than at once, and hitting the cap is
  itself a signal worth logging loudly.

## 9. Delete from the first deploy rather than ship log-only

- **Date:** 2026-08-09
- **Considered:** ship with deletion disabled, read the log once against production data, then flip a
  constant · delete from the first deploy
- **Chosen:** delete immediately. One less constant to forget flipping, one less deploy.
- **Why the alternative was offered:** with no page (decision 5), the log-only pass was the last chance
  to eyeball the anti-join's real answers before anything was destroyed. Rejected on the strength of the
  remaining defences — the floor, the cap, the pattern gate, and a backlog measured at 2 files.
- **Trade-off:** the defences and decision 10's probe are now the entire pre-flight. The probe should be
  run before the first real save, not after.

## 10. Verify with a written end-to-end probe, not a screen or a heartbeat

- **Date:** 2026-08-09
- **Considered:** a heartbeat log line on every run · the admin page from decision 5 · a documented
  manual probe
- **Chosen:** the probe, written into `image-storage.md` beside the one that already verifies the ✕
  control's delete. It matches how this repo already establishes storage facts — by probing rather than
  reasoning — and it is re-runnable whenever a regression is suspected.
- **Why not the heartbeat:** it proves the sweep ran and nothing about it being right.
- **Trade-off:** it is manual, and it requires temporarily editing the floor constant — which is part of
  why the floor is a named constant.

## 11. Gate candidates on `IMAGE_PATH_PATTERN`

- **Date:** 2026-08-09
- **Considered:** filter `.emptyFolderPlaceholder` explicitly · match every candidate against the
  existing path regex
- **Chosen:** the regex, which `lib/supabase/storage.ts` already builds from `PATH_PREFIX` for the
  schema's use. It buys a stronger property than placeholder-filtering does: **the sweep can only ever
  delete files shaped exactly like the ones it creates**, so anything else in the bucket — a placeholder,
  a file put there by hand, a future prefix — is invisible to it.
- **Trade-off:** a future change to the path convention must consider the sweep. Mitigated by the
  pattern already being the single source for that convention.

## 12. Close known issue 4, and move its residual caveat

- **Date:** 2026-08-09
- **Considered:** amend the entry to "mitigated, not eliminated" · close it as resolved
- **Chosen:** close it, following issue 3's shape — struck heading, text kept as a record of what the
  problem was and which alternatives were rejected.
- **The wrinkle, and how it is handled:** `CLAUDE.md:151` currently calls orphaned files "the cost
  accepted" and links to the entry, so closing it leaves a reader concluding the eager-upload design has
  no cost left. It still has one — a 7-day window, and nothing collected at all if the owner never
  writes again. That caveat moves into `image-storage.md`'s question 7, and `CLAUDE.md:151` is reworded
  rather than left pointing at a resolved entry. This is why `CLAUDE.md` came back into scope after
  initially being left out.
- **Trade-off:** the residual cost is recorded somewhere other than the issue log, which is where a
  reader might look for it first.
