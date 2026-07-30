# Plan: Admin sidebar shell

## Goal

Replace the single `/admin` page with a sidebar-navigated admin area. A persistent rail on the left
lists two destinations — **Create Recipes** and **Manage Recipes** — and the region to its right
renders whichever one is selected.

Both destinations are placeholders for this pass: a centered card naming the page. The shell is the
deliverable. The existing `/admin` recipes grid and its "New Recipe" dialog are removed rather than
carried forward, because the real versions of both pages are being rebuilt from scratch afterwards.

## Non-goals

- No real create form and no recipe management UI — placeholders only.
- No responsive or mobile behaviour. The rail is desktop-only and stays at full width at every
  viewport; narrow screens are knowingly unhandled (see `decisions.md` §3).
- No change to `AdminGate` or to how `/admin` is gated.
- No hardening of the prerender gap CLAUDE.md describes under "Auth gating" — `/admin` keeps
  flushing its shell before the gate resolves. Out of scope here.
- No restructuring of `components/feature/` vs `components/shared/`, which CLAUDE.md notes is
  separately mid-unwind.

## Context

CLAUDE.md is the reference for the established conventions this follows — the domain-module
three-file shape, the `Suspense`-around-request-data rule, `components/ui/` being generated rather
than hand-edited, the grouped import comments, and the prettier discipline. What's specific to this
change:

- **Root layout already renders `<main>`.** `app/layout.tsx` wraps `children` in
  `<main className="w-full flex-1">` between `Navbar` and `Footer`. Anything the admin shell adds
  lives inside that element, which rules out shadcn's `SidebarInset` (it renders its own `<main>`,
  and `<main>` may not nest).
- **The sidebar theme tokens already exist.** `app/globals.css` defines the full `--sidebar-*` set
  in both `:root` and `.dark`, and maps them to `--color-sidebar-*` in `@theme inline`. The
  primitive's styling works with no CSS additions.
- **`radix-ui` is already a dependency** (the unified package, which is what the generated
  primitives import from), so the install is expected to need no new npm packages.
- **`components/ui/` was bulk-generated in bc8d9c1** and the tree is clean, so `tooltip.tsx` is
  already present. `sidebar.tsx`, `sheet.tsx`, and `skeleton.tsx` are the genuinely missing pieces.
- **`app/admin/layout.tsx` holds the gate**, rendering `_components/AdminGate.tsx` inside
  `Suspense`. That wrapper is load-bearing under `cacheComponents: true` and is not touched.

## Approach

Install shadcn's `sidebar` primitive and drive it in its **non-collapsing** configuration, so the
rail sits in normal document flow between the site's navbar and footer instead of pinning itself to
the viewport. The admin layout gains a client-side `SidebarProvider` wrapping the rail and a plain
content `div`; the gate stays exactly where it is, above the shell.

The primitive was chosen over a hand-rolled two-link nav so that the collapse, drawer, and
keyboard-shortcut behaviour is already in place when the admin area grows — adding it later becomes
a prop change rather than a rewrite. The cost is a large generated file whose mobile and collapse
machinery goes unused for now. See `decisions.md` §4.

The non-collapsing configuration is the load-bearing detail. `Sidebar`'s default
(`collapsible="offcanvas"`) positions itself `fixed inset-y-0` at `h-svh`, which would slide beneath
the navbar and across the footer; `collapsible="none"` renders a plain in-flow flex column at
`w-(--sidebar-width)` with no fixed positioning and no `Sheet`. `SidebarProvider` is still required
even so, because `SidebarMenuButton` calls `useSidebar()` internally. See `decisions.md` §5.

Structure:

```
AdminLayout (server)
├── Suspense → AdminGate            ← unchanged, still load-bearing
└── SidebarProvider                 ← client boundary, from components/ui/sidebar
    ├── AdminSidebar                ← Sidebar collapsible="none"
    └── div.flex-1                  ← content region (deliberately NOT SidebarInset)
        └── {children}
```

`SidebarProvider`'s wrapper is `min-h-svh flex w-full`; it needs `min-h-0 flex-1` layered on so the
footer isn't pushed a full viewport down. `tailwind-merge` resolves the `min-h-*` conflict in favour
of the override.

## Components

- **`app/admin/layout.tsx`** — modified. Keeps `Suspense`/`AdminGate` verbatim; wraps `children` in
  `SidebarProvider` + `AdminSidebar` + the content `div`.
- **`app/admin/page.tsx`** — replaced. Its entire body becomes `redirect("/admin/create")`, so
  `/admin` resolves to a real destination. The redirect reads no request data, so it stays
  prerenderable under `cacheComponents`.
- **`app/admin/create/page.tsx`** — new. Server component; centered card reading "Create Recipes".
- **`app/admin/manage/page.tsx`** — new. Identical but for the text: "Manage Recipes".
- **`app/admin/_components/AdminSidebar.tsx`** — new. `"use client"`, solely for `usePathname()` to
  drive `isActive`. Composes `Sidebar` → `SidebarContent` → `SidebarGroup` → `SidebarMenu`, with one
  `SidebarMenuButton asChild isActive={…}` per destination wrapping a `next/link`. The two
  destinations live in one array in this file, so adding a third is a one-line change.
- **`app/admin/_components/AdminGate.tsx`** — behaviour unchanged, docblock amended. Its closing
  sentence currently justifies the prerender trade-off partly with "the write is separately guarded
  by `requireUser()` in `createRecipe`", which stops being true when that action is deleted. Reword
  to reference RLS and the standing rule for future actions. The `Suspense` requirement it documents
  stays exactly as written.
- **`app/admin/_components/NewRecipeDialog.tsx`** — deleted.
- **`lib/recipes/actions.ts`** — deleted. `createRecipe` was its only export, and an empty
  `"use server"` file carries no meaning.
- **`lib/recipes/schema.ts`** — deleted. `createRecipeSchema` and `CreateRecipeState` existed only
  to serve that action; `NewRecipeDialog` was their only other consumer. See `decisions.md` §6.
- **`lib/recipes/queries.ts`** — untouched. `getRecipes()` still serves `/` and `/recipes`.
- **`components/ui/sidebar.tsx`, `sheet.tsx`, `skeleton.tsx`** — generated by
  `npx shadcn@latest add sidebar`. Not hand-edited, per CLAUDE.md.
- **`hooks/use-mobile.ts`** — created by the same command. `hooks/` doesn't exist yet; the `hooks`
  alias is already declared in `components.json`.
- **`CLAUDE.md`** — prose fixes for the files this deletes, detailed below.

### Stale-reference cleanup

Deleting `createRecipe` leaves five references to files that no longer exist. Four are in CLAUDE.md,
by section (line numbers as of bc8d9c1); the fifth is the `AdminGate.tsx` docblock noted above.

1. **Layout tree, route list (~36)** — `/admin` gains `/admin/create` and `/admin/manage`.
2. **Layout tree, `lib/recipes/` (~42)** — currently "same three-file shape"; becomes queries-only
   until the write path returns.
3. **Caching, `updateTag` bullet (~89–90)** — cites `lib/recipes/actions.ts` as the worked example.
   Reword to state the rule prospectively; this deletion removes the repo's only live `updateTag`
   call site.
4. **Auth gating, Writes bullet (~100)** — same stale citation. Reword to "every new action calls
   `await requireUser()` before touching the database" rather than pointing at a deleted file.

## Risks

- **The primitive fights the site chrome.** Mitigated by `collapsible="none"` plus the
  `min-h-0 flex-1` override, and verified visually: navbar above, footer below, no overlap, footer
  not displaced downward. If the rail still misbehaves, the fallback is a hand-rolled nav
  (`decisions.md` §4 records it as the rejected option, so reverting is a known path).
- **`add sidebar` may rewrite existing primitives.** It can regenerate `tooltip.tsx`, `button.tsx`,
  `input.tsx`, and `separator.tsx`. Since bc8d9c1 generated them from the same registry and style,
  the diff should be empty or trivial — but check `git diff` after installing and run
  `npm run format` if the CLI reformats anything, so `format:check` stays clean.
- **CLAUDE.md loses its only `updateTag` example.** Accepted. `lib/auth/actions.ts` survives and
  still demonstrates the `useActionState` state-object convention; only the cache-invalidation
  example goes, and the rule is documented well enough to stand without a file reference.
- **`lib/recipes/` drops to one file**, off the prescribed three-file shape. Accepted as temporary:
  the convention describes a domain that has writes, and this one no longer does. The rebuilt Create
  Recipes page restores both files.
- **Dead unused exports in the generated file.** `SidebarTrigger`, the `Sheet` path, the
  `use-mobile` hook, and the Ctrl/Cmd-B shortcut all ship unused. This is the accepted cost of
  `decisions.md` §4, not an oversight.

## Verification

There is no test suite (CLAUDE.md), so this is the gate:

- `npm run typecheck`, `npm run lint`, `npm run format:check` all clean.
- `npm run dev`, signed in as the owner: `/admin` lands on Create Recipes; both rail links navigate;
  the active item is visibly distinguished; navbar sits above and footer below with no overlap and
  no viewport-height gap; both placeholder cards are centered in the content region.
- Signed out: `/admin`, `/admin/create`, and `/admin/manage` all end up redirected to `/`.

## Open questions

- Exact `Card` composition for the placeholder — whether the text sits in `CardContent` alone or
  gets a `CardHeader`/`CardTitle`. Cosmetic; implementer's call.
- Whether the rail carries a header above the two items (e.g. a `SidebarGroupLabel` reading "Admin",
  or a `SidebarHeader`). Not required by the ask.
- Whether "Create Recipes" and "Manage Recipes" get lucide icons in the rail. The primitive supports
  them and `lucide-react` is already a dependency, but the ask specified text labels only.
