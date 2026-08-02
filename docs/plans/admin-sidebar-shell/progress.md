# Progress: Admin sidebar shell

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-07-30

- Did: implemented the shell — installed the `sidebar` primitive (declining all four overwrite
  prompts, so the pre-existing primitives are untouched), added `AdminSidebar`, the two placeholder
  routes and the `/admin` redirect, and deleted `NewRecipeDialog` plus `lib/recipes/actions.ts` and
  `schema.ts`.
- Did: fixed the shell collapsing to the height of the nav buttons. Root cause: the root layout's
  `<main>` is a plain block, so `flex-1` on `SidebarProvider` resolved to nothing while `min-h-0` had
  already cancelled the primitive's `min-h-svh`. Confirmed from the live DOM — `main` measured
  `display: block`, height 618. Fix: `<main>` becomes `flex flex-col` in `app/layout.tsx` and the
  provider keeps `min-h-0 flex-1`. An intermediate `min-h-full` attempt was reverted as it relies on a
  percentage resolving against a flex-grown parent. plan.md updated.
- Did: `hooks/use-mobile.ts` fails `react-hooks/set-state-in-effect`, so the existing
  `components/ui/**` exemption in `eslint.config.mjs` was extended to it by name.
- Did: six stale references fixed rather than the four the plan predicted — the Domain modules line
  and the Auth gating cost paragraph in CLAUDE.md also referred to the deleted write path and to
  recipe cards in the admin shell.
- Verified: `typecheck`, `lint`, `format:check` and `npm run build` all clean. `/admin` builds static,
  `/admin/create` and `/admin/manage` partial-prerendered. The build's `useSearchParams` bailout and
  `DYNAMIC_SERVER_USAGE` errors were confirmed pre-existing by building HEAD with the work stashed.
- Next: the `--sidebar-*` tokens in `app/globals.css` are inconsistent and make the rail look wrong —
  light mode aliases `--sidebar` to `--background` so the rail has no presence, and the dark block is
  left over from the stock neutral theme (`--sidebar-border: oklch(1 0 0)` renders a pure-white rule,
  `--sidebar-primary` is `--chart-4` blue). Pre-existing, awaiting a decision on the treatment.
