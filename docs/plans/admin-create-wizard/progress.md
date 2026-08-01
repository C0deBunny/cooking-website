# Progress: Recipe Creator wizard

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-01 — Phase 0: the open question, closed

- **Did:** diagnosed the "neither recipe page renders" report from `c65bf67` and re-enabled the
  manage table's view/preview action.
- **Finding: both pages were always fine.** `/recipes/[slug]` and `/admin/preview/[slug]` each
  return 200 and render the full article. The 500s the previous session saw came from a dev
  server whose render workers had died — the only thing in the log was
  `Error: Jest worker encountered 2 child process exceptions, exceeding retry limit`, which is
  the worker crashing, not the route throwing. Restarting `next dev` fixed all three slugs with
  no code change. Reproduced the failure against the stale process and the success against a
  fresh one.
- **The trap, since it will happen again:** that error swallows whatever actually threw, and it
  is sticky — once the workers are gone every route 500s, so the symptom looks like "this page
  is broken" rather than "this server is broken". Restart `next dev` before believing a 500.
- **Consequence for the plan:** phase 3 has nothing to repair. It changes how both pages receive
  their data, as written, and the live preview inherits a working `RecipeArticle` rather than a
  broken one. `saveRecipe`'s redirect to `/admin/preview/${slug}` lands somewhere that works.
- **Also worth knowing:** all three published recipes render with **empty** Ingredients and
  Method sections, because `recipe_ingredients` and `recipe_steps` are genuinely empty. That is
  data, not a bug — the three seed recipes were written as `recipes` rows only. There is nothing
  to look at in those sections until the wizard writes something.
- **Verified:** `npm run lint`, `npm run typecheck`, `npm run format:check`, plus fetching all
  three slugs and `/admin/preview/appelmoes`.
- **Next:** phase 1.

### Phase 1 gate — answered, and it passes

`select count(*) from recipe_ingredients where group_label is not null` returns **0**. The whole
child-table space is empty:

| table                | rows                     |
| -------------------- | ------------------------ |
| `recipes`            | 4 (3 published, 1 draft) |
| `recipe_ingredients` | 0                        |
| `recipe_steps`       | 0                        |
| `recipe_images`      | 0                        |

Dropping `group_label` destroys nothing.

**How this was run without Docker and without the dashboard:** `npx supabase db query --linked
"<sql>"`. The CLI is linked and authenticated, and that subcommand goes through the Management
API — the same path the SQL editor uses — so it needs neither Docker nor a shadow database. The
plan assumed this had to be a human step in the dashboard; it does not. Worth remembering as the
Docker-free way to inspect _data_, next to `npm run db:types` for inspecting _schema_.
