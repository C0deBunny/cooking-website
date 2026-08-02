# Decisions: Admin sidebar restyle

## 1. Restyle the existing rail rather than replace it

- **Date:** 2026-08-01
- **Considered:** restyle the `Sidebar` in place · replace it with tabs or a segmented control above
  the content · leave it and wait until there are more than two destinations
- **Chosen:** restyle in place — the rail stays, it just gets finished. Because the complaint was that
  it looked unfinished, not that it was the wrong navigation pattern, and the admin area is expected to
  grow past two destinations.
- **Trade-off:** a full-height rail for two links stays disproportionate until a third destination
  arrives. Accepted; the retoned surface is what carries the empty space in the meantime.

## 2. Quiet rail with an edge marker, not a solid orange fill

- **Date:** 2026-08-01
- **Considered:** **A** quiet rail — neutral tint, orange demoted to a left accent bar · **B** keep the
  solid fill, move active to `--sidebar-primary` with white text · **C** card rail that terminates
  after the nav instead of stretching to the footer
- **Chosen:** A. B fails on contrast — `--sidebar-primary` at `oklch(0.75 …)` under
  `--sidebar-primary-foreground` (near-white) is roughly 2.2:1, and darkening it to pass would shift
  the brand orange everywhere else it is referenced. It also stays a heavy slab, which was the original
  complaint. C was rejected twice: once on cost (`collapsible="none"` means hand-rolling the card, and
  `SidebarProvider`'s flex row stretches it without `items-start`), and again after the footer was cut,
  when it became more attractive but still not worth the complexity.
- **Trade-off:** the active state now depends on three weak signals combined (bar, weight, faint tint)
  rather than one loud one. If any single one is dropped later, the state gets hard to read. C is the
  recorded fallback if the empty rail bottom turns out to be the bigger problem.

## 3. No footer in the rail

- **Date:** 2026-08-01
- **Considered:** footer with owner email + sign-out · footer showing the owner email only · no footer
- **Chosen:** no footer. Sign-out already lives in the navbar's `AuthButton`, so a second control would
  duplicate it, and the owner email alone did not earn the space.
- **Trade-off:** the bottom two-thirds of the rail is empty, and the retoned tint is the only thing
  making that read as deliberate. Bought something real in exchange: with no footer there is no
  `getCurrentUser()` call, no server component passed into a client component, no `Suspense` boundary,
  and no brush with the `cacheComponents` trap CLAUDE.md warns about. `AdminSidebar` needs nothing from
  the server, which removed the fiddliest third of the design.

## 4. Full-bleed rows instead of inset pills

- **Date:** 2026-08-01
- **Considered:** keep the inset pill with a smaller radius · full-bleed rows spanning the rail
- **Chosen:** full-bleed. The highlight reaches both rail edges, the former gutters become clickable,
  and the active bar sits flush against the rail edge rather than floating in a gutter.
- **Trade-off:** none identified. It also retired an open question — with no corners, the `--radius: 1rem`
  problem (`rounded-md` computing to 14px, making rows read as lozenges) stops applying, so no local
  radius override is needed.

## 5. Retone the whole dark sidebar ramp, not just the white border

- **Date:** 2026-08-01
- **Considered:** fix only `--sidebar-border` (the visible bug) · retone the full dark `--sidebar-*` set
- **Chosen:** retone the full set. The dark block is stock shadcn neutral grey sitting inside a theme
  that warms every other token to hue 75. Fixing only the border would leave a cold grey rail inside a
  warm brown app — a subtler wrong than the one being fixed. Two outright bugs were found in the same
  block: `--sidebar-border: oklch(1 0 0)` (pure white) and `--sidebar-primary: oklch(0.4878 0.2432
264.4045)`, byte-identical to `--chart-4`.
- **Trade-off:** grows the change set from 2 tokens to 7. All are `--sidebar-*`, so no public route is
  affected. Two further cold-neutral tokens (`--sidebar-accent-foreground`, `--sidebar-ring`) were
  found after the mockup was reviewed and are deliberately left in `plan.md`'s open questions rather
  than folded in unreviewed.

## 6. Ripple on click, over a CSS-only press state

- **Date:** 2026-08-01
- **Considered:** ripple originating at the click point · `active:` background or scale press state ·
  no click feedback at all
- **Chosen:** ripple. Reviewed live in the mockup and kept.
- **Trade-off:** a ripple is a Material Design signature and this project is shadcn/Tailwind, which
  deliberately has none — the sidebar becomes the only surface in the app that ripples. Accepted with
  that understood. It also adds ~25 lines of imperative DOM code to an otherwise declarative component.
  Cost is contained: `SidebarMenuButton` already carries `overflow-hidden` so clipping is free,
  `AdminSidebar` is already `"use client"` so there is no new boundary, and
  `prefers-reduced-motion` is honoured. The press state remains the one-class fallback.

## 7. Hover at the "Subtle" value, ΔL 0.02

- **Date:** 2026-08-01
- **Considered:** Subtle (light `oklch(0.945 0.012 73.684)`, ΔL 0.02) · Medium (ΔL 0.03) ·
  Strong (ΔL 0.04), each with a matching dark value so the two themes feel equally pronounced
- **Chosen:** Subtle, after comparing all three live in the mockup. Chosen against the recommendation
  — Medium was suggested on the grounds that a full-width tint at ΔL 0.02 is less legible than an inset
  pill at the same value, since there is no edge to define it.
- **Trade-off:** hover feedback is close to the perceptual threshold; it was in fact missed entirely on
  first review, before hover was wired up live. Defensible because the active state no longer relies on
  the tint — the full-height bar and `font-semibold` carry it — so hover only needs to acknowledge the
  cursor, not identify the page. If it proves too quiet in real use, Medium is a one-value change.

## 8. Disable text selection across the rail

- **Date:** 2026-08-01
- **Considered:** `select-none` on the rows only · on the whole rail · leave selection enabled
- **Chosen:** the whole rail, so the header and the group label do not select either. Dragging across
  nav chrome selecting label text reads as a bug.
- **Trade-off:** labels can no longer be copied out of the rail. Trivial for two known static strings;
  worth revisiting if the rail ever carries dynamic or user-supplied text. Note this is a genuine
  addition — shadcn sets `select-none` on `SidebarMenuBadge` but not on `SidebarMenuButton`.
