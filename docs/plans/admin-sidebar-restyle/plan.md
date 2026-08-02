# Plan: Admin sidebar restyle

## Goal

The `/admin` rail from `docs/plans/admin-sidebar-shell/` shipped functional but unfinished. Three
complaints, all confirmed against the code rather than taken on impression:

1. **The orange reads as a heavy slab.** `--sidebar-accent` is a saturated peach filling the whole row.
2. **The rail looks empty.** Two bare text labels at the top of a full-viewport column, nothing else.
3. **You cannot tell which page you are on.** `hover:` and `data-active:` resolve to the same token,
   so the active row and a hovered row are pixel-identical.

Restyle the rail into something finished without changing what it does. No new destinations, no new
behaviour — the same two links, styled like a nav rail instead of two floating buttons.

This is the direct successor to the shell plan, whose own **Open questions** section asked whether the
rail should carry a header and whether the items should get lucide icons. This plan answers both yes.

## Non-goals

- No new destinations. The `items` array still holds exactly Manage and Create.
- No responsive or mobile behaviour. Still deferred, as in the shell plan (`admin-sidebar-shell/decisions.md` §3).
- No change to `AdminGate` or to the prerender gap CLAUDE.md documents under "Auth gating".
  `app/admin/layout.tsx` changes by exactly one prop — the `--sidebar-width` override — and nothing
  else; the `Suspense`/`AdminGate` pair stays verbatim.
- **No owner identity or sign-out in the rail.** Deliberately dropped — see `decisions.md` §3.
- No hand-edits to `components/ui/sidebar.tsx`. Every deviation is a per-instance `className`.
- No change to `--accent`, `--primary`, `--background`, or any non-`--sidebar-*` token. Public routes
  are untouched.

## Context

CLAUDE.md is the reference for the established conventions — grouped import comments, `components/ui/`
being generated rather than hand-edited, server components by default, prettier at `printWidth: 200`.
What is specific to this change:

- **`hover:` and `data-active:` collide.** `sidebarMenuButtonVariants` (`components/ui/sidebar.tsx:364`)
  sets `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` _and_
  `data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground`. Identical declarations.
  Distinguishing the two states cannot be done with colour alone from within this primitive — the
  active row needs a second signal.
- **Several `--sidebar-*` tokens were never retoned.** In `:root`, `--sidebar` is byte-identical to
  `--background` and `--sidebar-accent` is byte-identical to `--accent`. The rail is therefore not a
  distinct surface, and its hover fill is the app's loudest accent colour.
- **The entire dark `--sidebar-*` set is stock neutral grey.** `.dark` warms every other token
  (`--background: oklch(0.18 0.012 75)`, hue 75 throughout) but leaves the sidebar block at
  `oklch(0.2046 0 0)`, `oklch(0.2686 0 0)`, `oklch(0.9851 0 0)` — untouched shadcn defaults sitting
  inside a warmed theme. The rail reads visibly colder than the page around it. Two outright bugs live
  in the same block: `--sidebar-border` is `oklch(1 0 0)` (pure white) and `--sidebar-primary` is
  `oklch(0.4878 0.2432 264.4045)`, byte-identical to `--chart-4` — a chart colour that leaked in.
- **`--radius: 1rem`** makes `rounded-md` compute to 14px. On a 32px row that is nearly a lozenge, and
  it is a large part of why the current rows read as floating blobs. Full-bleed rows make this moot.
- **`SidebarMenu` is already `gap-0`** (`flex w-full min-w-0 flex-col gap-0`). Rows already render
  flush; nothing is needed to connect them.
- **`SidebarMenuButton` already carries `overflow-hidden`**, so ripple clipping is free.
- **`SidebarProvider` spreads `...style` after its own defaults** (`components/ui/sidebar.tsx:121-124`),
  so `--sidebar-width` is overridable by prop without fighting `tailwind-merge`.
- **`AdminSidebar` is already `"use client"`** for `usePathname()`. The ripple handler needs no new
  client boundary.
- **Dark `--primary` is the same orange as light** (`oklch(0.75 0.183 55.934)`), so the active marker
  needs no dark-mode special case.

## Approach

Three layers, applied together.

**Retone the tokens.** Light gets two edits so the rail becomes its own surface and its hover stops
shouting. Dark gets five, because the problem there is not a bug to patch but a ramp that was never
themed — fixing only the white border would leave a cold grey rail inside a warm brown app. All edits
are confined to `--sidebar-*`; nothing a public route reads changes.

**Demote the orange from a fill to a marker.** Since the primitive cannot distinguish hover from active
by colour, the active row gains two signals the hover state does not have: `font-semibold`, and a
full-height 4px orange bar flush against the rail's left edge, drawn as a `before:` pseudo-element. The
shared tint then stops carrying meaning on its own and can drop to a whisper. This is what lets the
hover value be as quiet as it is.

**Give the rail a skeleton.** A `SidebarHeader` with a title, a `SidebarGroupLabel`, and a lucide icon
per row. Rows go full-bleed — the highlight spans the rail edge to edge rather than sitting inset as a
pill — which also makes the former gutters clickable and retires the 14px-radius problem, since
full-bleed rows have no corners. The rail keeps its full height with nothing at the bottom; the retoned
tint is what makes that space read as a deliberate surface rather than a void (`decisions.md` §3).

A solid-orange active fill was considered and rejected on contrast: `--sidebar-primary` at
`oklch(0.75 …)` under a near-white foreground is roughly 2.2:1, and darkening it enough to pass would
shift the brand orange everywhere else it is referenced. A card-shaped rail that terminates after the
nav was considered twice and rejected both times. See `decisions.md` §1, §2.

## Components

### `app/globals.css` — 7 token edits

Light (`:root`):

| Token              | From                        | To                          | Why                             |
| ------------------ | --------------------------- | --------------------------- | ------------------------------- |
| `--sidebar`        | `oklch(0.98 0.016 73.684)`  | `oklch(0.965 0.014 73.684)` | was identical to `--background` |
| `--sidebar-accent` | `oklch(0.901 0.076 70.697)` | `oklch(0.945 0.012 73.684)` | was identical to `--accent`     |

Dark (`.dark`):

| Token                  | From                            | To                         | Why                          |
| ---------------------- | ------------------------------- | -------------------------- | ---------------------------- |
| `--sidebar`            | `oklch(0.2046 0 0)`             | `oklch(0.215 0.012 75)`    | cold neutral in a warm theme |
| `--sidebar-foreground` | `oklch(0.9851 0 0)`             | `oklch(0.96 0.01 75)`      | same, matches `--foreground` |
| `--sidebar-accent`     | `oklch(0.2686 0 0)`             | `oklch(0.26 0.012 75)`     | same                         |
| `--sidebar-border`     | `oklch(1 0 0)`                  | `oklch(0.3 0.008 75)`      | **bug** — pure white border  |
| `--sidebar-primary`    | `oklch(0.4878 0.2432 264.4045)` | `oklch(0.75 0.183 55.934)` | **bug** — leaked `--chart-4` |

The light `--sidebar-accent` value is the "Subtle" preset from the mockup, ΔL 0.02 from the rail. The
dark value moves by a matching amount so the hover feels equally pronounced in both themes.

Plus one `@keyframes ripple` block (scale 0→1, opacity 0.22→0) and a
`@media (prefers-reduced-motion: reduce)` override collapsing it to ~1ms.

### `app/admin/_components/AdminSidebar.tsx`

The only component that changes. Still `"use client"`, still one `items` array.

- **`items` gains an `icon` field** — `LayoutList` for Manage, `Plus` for Create, both from
  `lucide-react` (already a dependency). The file's existing comment — _"Add a destination here and it
  appears in the rail — nothing else needs touching"_ — stays true.
- **`SidebarHeader`** with a `ChefHat` icon and the text "Admin", `border-b border-sidebar-border`.
- **`SidebarGroupLabel`** reading "Recipes".
- **Full-bleed rows** — remove the group/menu horizontal padding so the highlight reaches both rail
  edges; the row itself carries the inner padding instead.
- **`select-none` on the rail.** Nav chrome is not prose; dragging across it should not select label
  text. shadcn sets this on `SidebarMenuBadge` but not on `SidebarMenuButton`, so it is a real addition.
- **Active marker** — on `SidebarMenuButton`:
  `data-active:font-semibold` plus
  `data-active:before:absolute data-active:before:inset-y-0 data-active:before:left-0 data-active:before:w-1 data-active:before:bg-primary`.
  `inset-y-0` rather than a centred fixed height, and no `rounded-full` — square ends, flush top and
  bottom.
- **Ripple** — an `onPointerDown` handler on the `Link`. Roughly 25 lines: read
  `getBoundingClientRect()`, compute the click point, size the ripple to
  `Math.hypot(max(x, w-x), max(y, h-y))` so it always covers the row regardless of where it is clicked,
  append a `<span>`, remove it on `animationend`. `overflow-hidden` on the button clips it for free.
- **Rail width** — `style={{ "--sidebar-width": "14rem" }}` on `SidebarProvider` in
  `app/admin/layout.tsx`, which is the one-line exception to that file being untouched. Overriding the
  variable is preferred to a `w-*` class because `SidebarProvider` already spreads `...style` after its
  own defaults.

### Untouched

`components/ui/sidebar.tsx` (generated), `app/admin/_components/AdminGate.tsx`, `lib/auth/*`,
`lib/recipes/*`, `app/layout.tsx`, and every public route. `app/admin/layout.tsx` changes by one prop.

## Risks

- **The retoned values are eyeballed.** They were derived from the existing ramp and reviewed in the
  mockup, not sampled from a palette tool. Mitigated by the mockup using literal `oklch()` values
  rather than approximations, so what was reviewed is what ships. Verify in-browser in both themes
  before calling it done.
- **Per-instance overrides on a generated primitive can drift.** The `before:` marker, the full-bleed
  padding, and `rounded-none` all live in `AdminSidebar`'s `className`, not in `sidebar.tsx`. They
  survive `npx shadcn@latest add sidebar` (which rewrites the primitive, not the caller), but they
  assume the primitive keeps `overflow-hidden`, `gap-0`, and `data-active:` on the same nodes. If the
  rail ever renders wrong after a regeneration, this is the first place to look.
- **The ripple is a Material idiom in a system that has none.** Nothing else in the app ripples, so the
  sidebar becomes the only surface that does. Accepted knowingly (`decisions.md` §6). The fallback if
  it reads as borrowed is a CSS-only press state — `active:bg-sidebar-accent/70` or a 0.98 scale — which
  is one class and no JS.
- **`select-none` costs the ability to copy a label** out of the rail. Trivial for two known strings;
  worth remembering if the rail ever carries dynamic text.
- **The empty rail bottom is a bet.** Nothing anchors the lower two-thirds; the retoned tint is doing
  all the work. It was reviewed only in a mockup scaled to ~65% with a shortened body, so the real
  proportion of empty space is larger than what was judged. If it reads as unfinished at full height,
  the card rail is the recorded fallback (`decisions.md` §2).

## Verification

No test suite (CLAUDE.md), so this is the gate:

- `npm run typecheck`, `npm run lint`, `npm run format:check` all clean.
- `npm run dev`, signed in as the owner, **in both light and dark**:
  - the active row is unambiguous at a glance — bar, weight, and tint together;
  - hovering the inactive row is visibly different from the active row;
  - the rail reads as a distinct surface from the page body;
  - the highlight spans the full rail width and the former gutters are clickable;
  - rows are flush with no gap between them;
  - dragging across the rail selects nothing;
  - the ripple originates at the click point and completes without being cut off by navigation;
  - dark mode shows no white border and no blue anywhere.
- With OS "reduce motion" enabled, the ripple does not animate.
- Signed out: `/admin`, `/admin/manage`, `/admin/create` still redirect to `/`.

## Open questions

- **Two further cold-neutral tokens were found but are not in the change set above**, because they were
  not part of the reviewed mockup: dark `--sidebar-accent-foreground` (`oklch(0.9851 0 0)`, neutral
  white where `--foreground` is `oklch(0.96 0.01 75)`) and dark `--sidebar-ring` (`oklch(0.5555 0 0)`,
  neutral grey where `--ring` is the orange `oklch(0.75 0.183 55.934)`). Same class of problem as the
  five that are included. `--sidebar-ring` only shows on keyboard focus. Implementer's call whether to
  fold them in.
- Exact ripple opacity and duration. The mockup uses `0.22` and `520ms` with
  `cubic-bezier(0.2, 0.6, 0.35, 1)`; these were not deliberated.
- Whether `14rem` holds. It is sized for two short labels; a third destination with a longer name may
  push it back toward `16rem`.
- Icon choices are provisional — `LayoutList` and `Plus` were picked for legibility at 16px, not chosen
  from a survey.

## Assets

- [admin-sidebar-mockup.html](assets/admin-sidebar-mockup.html) — side-by-side "Now" vs "Proposed",
  built from the literal token values in `app/globals.css`. Interactive: light/dark toggle,
  hover-strength presets (Subtle/Medium/Strong, with the token table updating live), row-style toggle
  (full-bleed vs pill), ripple on/off, and annotation toggle. The ripple implementation in its
  `<script>` is the same algorithm the real component needs. Open it directly from disk; it is fully
  self-contained.
