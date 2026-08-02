# Progress: Admin manage-recipes page

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-01

- Did: built the page — `page.tsx`, `RecipeTableSection`, `RecipeTable`, `RecipeRow`,
  `TableSkeleton`, plus `app/admin/error.tsx`, `getRecipesForAdmin()`, `togglePublished`,
  `deleteRecipe`, and `formatTimestamp()` in `lib/utils.ts` (eaadfb8).
- Did: mounted `Toaster` and `TooltipProvider` in `app/admin/layout.tsx`. Both previously
  existed only in `app/dev/layout.tsx` — a gap `app/dev/_components/OverlaysSection.tsx` warns
  about, and one that fails quietly: `toast()` with no `Toaster` does nothing at all.
- Did: **the repository moved underneath this plan.** `8bb5c4f` landed the create form, the
  public detail page and the draft preview route between the plan being written and being
  implemented. Two non-goals dissolved, `lib/recipes/actions.ts` became an extension rather
  than a new file, and `plan.md` and `decisions.md` were corrected to match — see decision 14.
- Did: two things the plan did not anticipate. `togglePublished` and `deleteRecipe` both
  `.select("id")` and check the row count, because an RLS-refused write returns no error and
  zero rows — trusting the null error would report a silent no-op as success. And the disabled
  edit button needs a `<span>` wrapper to carry its tooltip, since a disabled button swallows
  the pointer events Radix listens for.
- Verified: `typecheck`, `lint` and `format` clean. `npm run build` passes with `/admin/manage`
  partial-prerendered — the real test of the `Suspense` boundary, since that risk only surfaces
  at build time. The `useSearchParams` and `DYNAMIC_SERVER_USAGE` errors in the build output
  were reconfirmed pre-existing by building with the work stashed, matching what
  `docs/plans/admin-sidebar-shell/progress.md` already recorded. `GET /admin/manage` returns
  200 with the static band and the skeleton in the flushed shell.
- Next / Blocked: **the table itself is unverified.** Everything past the gate needs a signed-in
  session, so the accordion, the three controls, publish and delete have not been exercised.
  The specific open item is risk 3 — whether `revalidatePath` actually refreshes the row after a
  publish, or whether `router.refresh()` is needed in the transition.
- Next: the edit route is now the only incomplete action. `RecipeForm` takes no props and is
  create-only, so it needs an optional recipe threaded through it as well as a new route.
