# Decisions: Admin sidebar shell

## 1. Delete the existing `/admin` recipes grid and dialog outright

- **Date:** 2026-07-30
- **Considered:** park it and ship placeholders only · move the grid into Manage Recipes now · keep
  `/admin` as a third "Overview" destination alongside the two new pages
- **Chosen:** park it — the grid, the tinted header band, and `NewRecipeDialog` are deleted, and both
  new pages ship as placeholders. Because the owner is rebuilding both pages properly rather than
  migrating what's there, so preserving the current implementation buys nothing.
- **Trade-off:** `/admin` temporarily has no working recipe functionality at all. Accepted knowingly
  — this is a personal site with a single owner, so there is no user-facing regression to manage.

## 2. Nest the admin shell inside the site navbar and footer

- **Date:** 2026-07-30
- **Considered:** shell inside the existing site chrome · full-viewport dashboard shell with its own
  root layout via `(site)` / `(admin)` route groups
- **Chosen:** inside the site chrome — the rail and content area fill the space within
  `app/layout.tsx`'s existing `<main>`. Because it needs no root-layout restructuring and the
  navbar's Admin link keeps behaving exactly as it does today.
- **Trade-off:** the rail cannot run the full window height, and the admin area reads as a page on
  the site rather than as a separate application. This is also what forces the non-collapsing
  configuration in §5.

## 3. Defer all mobile and narrow-viewport behaviour

- **Date:** 2026-07-30
- **Considered:** collapse the rail into a horizontal tab row below `md` · off-canvas drawer behind a
  hamburger · keep the rail at every width
- **Chosen:** ignore phone users for now — no breakpoint work of any kind. Because the admin area has
  exactly one user, who is on a desktop.
- **Trade-off:** `/admin` is effectively unusable on a phone until this is revisited. Cheap to fix
  later precisely because of §4 — the primitive's drawer already exists behind a prop.

## 4. Use shadcn's `sidebar` primitive over a hand-rolled nav

- **Date:** 2026-07-30
- **Considered:** hand-rolled client nav (~35 lines, `usePathname()` for active state, sidebar theme
  tokens) · shadcn's generated `sidebar` primitive · pure server-component nav with no active state
- **Chosen:** the shadcn primitive. Because collapse, the mobile drawer, and the keyboard shortcut
  then already exist, making the deferred work in §3 a prop change rather than a rewrite — and
  because CLAUDE.md already treats `components/ui/` as generated territory, so it's the conventional
  choice here.
- **Trade-off:** a large generated file plus `sheet.tsx`, `skeleton.tsx`, and a `use-mobile` hook,
  most of it serving behaviour deliberately unused for now. The rejected server-only option was
  cheapest but left the two links visually indistinguishable, which for a nav is a defect rather than
  a simplification.

## 5. Run `Sidebar` non-collapsing and skip `SidebarInset`

- **Date:** 2026-07-30
- **Considered:** `collapsible="none"` for an in-flow rail · keep the default `"offcanvas"` and
  override its heights and offsets with Tailwind utilities
- **Chosen:** `collapsible="none"`, with a plain `div` for the content region instead of
  `SidebarInset`. Because the default positions itself `fixed inset-y-0` at `h-svh`, which under §2
  would slide beneath the navbar and across the footer; and because `SidebarInset` renders a `<main>`
  element, which cannot legally nest inside the root layout's existing `<main>`.
- **Trade-off:** no collapse toggle and no `SidebarTrigger` while in this configuration, and
  `SidebarProvider` is still required regardless because `SidebarMenuButton` calls `useSidebar()`.
  Fighting the fixed positioning with utility overrides was rejected as the more fragile path.

## 6. Delete `lib/recipes/schema.ts` along with the action

- **Date:** 2026-07-30
- **Considered:** delete `actions.ts` only and keep `schema.ts` for imminent rewiring · delete both
- **Chosen:** delete both. Because `createRecipeSchema` and `CreateRecipeState` existed solely to
  serve `createRecipe`, and the owner confirmed the write path is being rebuilt from scratch rather
  than reconnected.
- **Trade-off:** `lib/recipes/` falls to a single file, off the three-file domain shape CLAUDE.md
  prescribes, and the repo loses its only live `updateTag` call site — so CLAUDE.md's caching example
  has to become prose. Both are accepted as temporary, resolved when the write path returns.
