# Decisions: Admin manage-recipes page

## 1. This slice is list, delete and publish only

- **Date:** 2026-08-01
- **Considered:** list + delete + publish, with edit and view-on-site stubbed · list plus all
  four actions including a real edit route · a read-only table with no actions at all
- **Chosen:** list, delete and publish. The edit form _is_ the create form, which is still a
  placeholder, so building edit here would drag an unbuilt second screen into this session.
  Delete and publish are two small actions against columns that already exist, so the page
  becomes genuinely useful without waiting for anything.
- **Trade-off:** two of the four row actions were expected to ship pointing nowhere. **Half of
  that cost disappeared before implementation** — `8bb5c4f` landed the public detail page and
  the draft preview route, so only _edit_ ships disabled. See decision 14. A single disabled
  button is a visible reminder of unfinished work, which is accepted over hiding it and
  forgetting.

## 2. The expanded row shows metadata only

- **Date:** 2026-08-01
- **Considered:** metadata that already lives on the `recipes` row · that plus child counts
  ("8 ingredients · 5 steps · 0 images") · a full ingredient and step preview
- **Chosen:** metadata only. Everything shown is on the row the table already fetched, so the
  page stays one query, expansion is pure client state, and clicking a row never triggers a
  fetch or a loading state.
- **Trade-off:** the page gives no signal about a half-finished draft — a recipe with a title
  and no steps looks identical to a complete one. Counts would have fixed that for one embedded
  query, and remain the obvious first addition if drafts start getting lost. The full preview
  was rejected outright as duplicating two screens that do not exist yet.

## 3. Inline collapsible row, not a side sheet

- **Date:** 2026-08-01
- **Considered:** an inline `colSpan` row expanding under its parent · a side sheet using
  `components/ui/sheet.tsx` · an inert server table with a `searchParams`-driven server sheet
- **Chosen:** inline. The detail stays in context, nothing overlays the list, and the mockup
  made the comparison concrete: a full-height panel for six fields of metadata is ceremony. The
  sheet is the right shape once the panel becomes an _editor_, which it is explicitly not.
- **Trade-off:** a second `<tr>` per row and content below the open row reflows downward.
  Combined with decision 9 that reflow is bounded, since at most one panel is ever open.

## 4. One client table, reversing the server-table-with-client-rows recommendation

- **Date:** 2026-08-01
- **Considered:** a server-rendered table whose rows are individual client islands · one client
  component owning the whole table · an inert server table driven entirely by the URL
- **Chosen:** one client table — after the first option had been recommended and provisionally
  accepted. Two things reversed it. First, once every row is a client island the "server table"
  is nominal: about fifteen lines of `<table>` and `<thead>` stay on the server while the row
  markup, the expand panel, the buttons and all the recipe data cross the boundary regardless.
  The work is not reduced, only fragmented across twelve islands instead of one. Second,
  `CLAUDE.md` says to add `"use client"` _where state or effects are needed_ — and three list
  controls plus per-row expansion is needed state. The first recommendation was defending the
  letter of a convention against its own stated reason.
- **Trade-off:** the table markup and the filter/sort code ship to the browser, on the order of
  a few kilobytes, on a page that is already behind an auth gate. The convention's default is
  bypassed, which is why the reasoning is recorded here at length rather than assumed obvious.

## 5. Ship all three list controls in v1

- **Date:** 2026-08-01
- **Considered:** none of them, `created_at desc`, add when the list becomes annoying (the YAGNI
  option, recommended) · a status filter only · search, status filter and sortable columns
- **Chosen:** all three, at the owner's request over the recommendation.
- **Trade-off:** this is what forced decision 4. Three controls need shared state across rows,
  which is precisely what per-row islands cannot provide, so the client boundary had to move.
  Recorded because the dependency runs the opposite way from how it looks: the feature choice
  drove the architecture, not the reverse.

## 6. Control state in `useState`, not `searchParams`

- **Date:** 2026-08-01
- **Considered:** plain client state in the table component · the URL via `searchParams`, with
  a server component reading and filtering, preserving the server-table shape
- **Chosen:** client state. The URL version was constructed specifically to reconcile decision
  5 with the original client-boundary recommendation, and it worked — but it costs a server
  round-trip on every control change. A sort click that waits for a network response before the
  rows reorder feels broken, and this project deploys to serverless where some of those are
  cold starts. Debouncing hides typing lag but cannot hide a click.
- **Trade-off:** filter and sort state does not survive a refresh and is not linkable, which is
  a real feature given up. It is recoverable without restructuring: a client table can seed its
  initial state from `searchParams` and push changes back with `history.replaceState`. The
  reverse migration — from server-rendered controls to instant ones — would be a rewrite, which
  is what made this the safe direction to choose first.

## 7. The manage read is its own uncached server-client query

- **Date:** 2026-08-01
- **Considered:** reuse the existing `getRecipes()` · add a separate `getRecipesForAdmin()` on
  the cookie-backed server client with no caching
- **Chosen:** a separate query. `getRecipes()` uses the public client inside `"use cache"`,
  which makes every such request `anon`, and RLS limits `anon` to published rows. Reusing it
  would produce a management page that renders correctly and never shows a draft — a silent
  failure, with nothing thrown and nothing logged. Reading cookies inside `"use cache"` is
  illegal in Next 16, so there is no way to make one function serve both.
- **Trade-off:** two queries over the same table, and the manage page is fully dynamic with no
  caching at all. Both are correct rather than regrettable: this is the same fork decision 13 of
  the schema redesign took for the draft preview route, for the same reason.

## 8. Publish is an icon button, not a `Switch`

- **Date:** 2026-08-01
- **Considered:** an eye / eye-off icon button in the row's action group · a `<Switch>` in the
  Status column, making the badge and its control the same element
- **Chosen:** the icon button. It sits with the other three actions, so all four row operations
  are in one place and share one interaction model.
- **Trade-off:** a switch reads more truthfully as a two-state toggle than an icon does. Against
  that, a switch is a single click that publishes to the internet with no confirmation and a
  large hit area — easy to catch by accident while scanning a list. The icon's tooltip
  ("Publish" / "Unpublish") carries the state that the switch would have shown.

## 9. Accordion — one row open at a time

- **Date:** 2026-08-01
- **Considered:** multiple rows open simultaneously, state as a `Set<number>` · exactly one,
  state as `number | null`
- **Chosen:** one. Opening a row closes whichever was open. The state simplifies from a set to
  a nullable id, and the list never grows unboundedly tall as rows accumulate.
- **Trade-off:** two recipes' details cannot be compared side by side. Not a real workflow for
  this page. Worth noting that this was free only because of decision 4 — with per-row islands,
  coordinating "close the other one" would have required lifting state out of them.

## 10. No open/close animation in v1

- **Date:** 2026-08-01
- **Considered:** a CSS transition on the expand · Radix `Collapsible`, already installed
  alongside `tw-animate-css` · no animation
- **Chosen:** none, after prototyping the transition in the mockup and dropping it. The working
  technique is recorded so it does not have to be rediscovered: a `<tr>` and `<td>` cannot be
  animated — table layout ignores height transitions and `overflow: hidden` on them — so it
  requires a nested `grid-template-rows: 0fr → 1fr` wrapper inside a zero-padding `<td>`, since
  `height: auto` is not animatable either. Radix was rejected separately: its `Root`, `Trigger`
  and `Content` must share one tree, but the trigger and the content are in different `<tr>`s,
  so it needs a `<tbody>` per row _and_ the same inner wrapper anyway.
- **Trade-off:** none meaningful, and it removes a cost rather than adding one. An animation
  needs something to transition _from_, so it would have forced every detail panel to stay
  mounted at zero height. Without it, only the open row's panel is in the DOM at all. That
  consequence is the reason this is recorded as a decision rather than dropped silently:
  re-adding the animation later is not a pure visual change, it changes what is mounted.

## 11. The collapsed row carries four columns

- **Date:** 2026-08-01
- **Considered:** title, status, difficulty, time and updated · title, status and updated only
- **Chosen:** four columns — chevron, Title, Status, Updated, actions. Difficulty and time moved
  into the expand panel as clutter. The collapsed row answers "which recipe, is it live, how
  stale is it" and deliberately nothing else. Status badges are centred under their header
  rather than left-aligned.
- **Trade-off:** sortable columns drop to Title and Updated, so "show me the quick ones" is no
  longer answerable here — accepted, since that is a browsing question and `/recipes` is where
  browsing lives. More consequentially, status becomes the only thing visually distinguishing
  one row from another, which promotes the status filter from convenience to primary control.

## 12. The slug appears nowhere on this page

- **Date:** 2026-08-01
- **Considered:** a monospace slug line under the title in the collapsed row · the slug in the
  expand panel only · absent entirely
- **Chosen:** absent. Removed from the row as clutter, then from the panel as well.
- **Trade-off:** no screen in the app currently shows which URL a recipe maps to, so checking
  one means opening the Supabase Table Editor. Tolerable while `/recipes/[slug]` does not exist
  and there is nothing to link to; revisit when the edit form lands, since that form has to
  show and edit the slug regardless.

## 13. One error boundary at `app/admin/`, showing the digest not the message

- **Date:** 2026-08-01
- **Considered:** `app/admin/error.tsx` only · that plus a root `app/error.tsx` · a root
  boundary only. And separately: a friendly line plus `error.digest` · a friendly line alone ·
  message, digest and stack in development
- **Chosen:** the admin boundary only, showing a plain sentence plus the digest. There are
  currently **zero** `error.tsx` files in the app, so a thrown query error reaches Next's
  built-in fallback — a bare page reading "Application error: a server-side exception has
  occurred", with the navbar, sidebar and footer gone and no way back but the browser button.
  Placed at `app/admin/`, the boundary renders inside the admin layout, so a failure replaces
  the content region and leaves the chrome standing. The digest is shown because Next scrubs the
  real message in production; the digest is the only handle that correlates the failure to a
  server log, and without it a production error is genuinely unfindable.
- **Trade-off:** the boundary catches its sibling segments and below, not the layout at its own
  level — so if `AdminGate` throws, nothing catches it. Closing that gap needs a root
  `app/error.tsx`, which was scoped out as broader than this page. Separately, no error boundary
  can catch a server action, so `togglePublished` and `deleteRecipe` still need their own
  `{ error?: string }` return and a `sonner` toast.

---

Decision 14 came out of implementation, after the repository moved underneath the plan.

## 14. The view action targets the preview route for drafts

- **Date:** 2026-08-01
- **Considered:** leave _view on site_ disabled as planned · enable it for published recipes and
  disable it on drafts · point it at `/recipes/[slug]` when published and
  `/admin/preview/[slug]` when not
- **Chosen:** the third. Decision 1 had accepted a permanently dead button on the reasoning that
  no public recipe page existed; `8bb5c4f` landed both `/recipes/[slug]` and
  `/admin/preview/[slug]` between this plan being agreed and being implemented, which removed
  the reason. Disabling it on drafts was the obvious next fallback and is still worse than
  branching, because a draft is exactly the row you most want to look at before publishing —
  and the route that can show one already exists.
- **Trade-off:** the button's destination now depends on state, so the same icon means two
  things. Mitigated by the tooltip, which reads "View on site" or "Preview draft" accordingly.
  Worth recording rather than absorbing silently: it is a direct contradiction of decision 1's
  trade-off, and a reader comparing the plan to the code would otherwise find them disagreeing.
