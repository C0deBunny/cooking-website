# Progress: Orphan image sweep

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-09

- Did: built the whole plan. `20260809202910_unreferenced_image_paths.sql` (pushed to the linked
  project), regenerated `types/database.ts` + `docs/schema-current.html`, `lib/images/sweep.ts`, the
  two `after()` calls in `lib/recipes/actions.ts`, and the doc edits — known issue 4 closed,
  `image-storage.md` question 7 rewritten with the probe, three `CLAUDE.md` rules.
- Decided the two open questions that were in the way: **`returns text[]`, not `setof text`** — a
  set-returning function is rows to PostgREST and therefore subject to the `max_rows` cap decision 2
  exists to escape, while a single array value cannot be truncated. And the log line is
  `[orphan-sweep] removed <returned>/<requested> of <unreferenced> …`, printing the count `.remove()`
  gave back against the count asked for, because an RLS-refused remove returns
  `{ data: [], error: null }` and a line reading only "removed 3" would report success over a
  regressed `select` policy. Hosted `max_rows` is still unverified and now moot.
- Verified: `npm run lint` and `npm run typecheck` clean. The function was called against the live
  bucket immediately after the push and returned exactly the two orphans the plan measured
  (`0b136ba0…`, `ea7fcce3…`), with the three referenced files untouched — the anti-join is confirmed
  end to end, as SQL.
- Next: **the probe in image-storage.md has not been run**, and it is the only thing that exercises
  the JS half — the `.list()` pagination, the pattern gate, the floor, and `after()` actually firing.
  Run it (drop `MIN_AGE_MS` to `0`, save a recipe, watch the log, restore) before the first real save.
  Until then nothing is observable: every object in the bucket is dated 2026-08-08, so a correct
  sweep collects nothing until roughly 2026-08-15.
- Note: `supabase db push` and `db:types` both worked with Docker Desktop down — they talk to the
  linked project directly. `db push` prints a `failed to cache migrations catalog` Docker warning
  after applying successfully, which reads like a failure and is not one.
