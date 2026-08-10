# Progress: Review & publish revamp

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

## 2026-08-10 — implemented, all three milestones

- **Did:** all three milestones, in the two commits the plan's order of work calls for.
  **Milestones 1 + 2 (`bd0888c`):** `ReviewPanel` rewritten around the sticky publish bar, the
  preview surface centred on `bg-background` under a caption, and `align` deleted from
  `RecipeArticle` along with its doc paragraph. **Milestone 3 (`1768dff`):** `PreviewRail` `top-6` →
  `top-16` plus the `PanelNav` doc note. Two comments the change made false were fixed alongside:
  `RecipeWizard`'s "underneath the checklist" note, and `PanelNav`'s "identical on all four panels".
- **Departures from the plan:** two, both small and both in the bar.
  - **The `Draft ▏Publish now` track is styled, not stock.** `ToggleGroupItem`'s built-in
    `data-[state=on]:bg-muted` is a tint that vanishes on a `bg-card` bar — verified on screen, both
    items read identically — and a segmented control you cannot read at a glance fails the one job
    decision 9 gives it. It is now a `bg-muted` track with the selected item lifted onto `bg-card`
    with a shadow, which is what the prototype drew. Decision 9 stands as written; it is kept, not
    trimmed.
  - **The bar's vertical divider carries `border-l border-border`.** `Separator`'s own
    `data-vertical:w-px` matches nothing, so it rendered 0px wide. Copied the navbar's working
    idiom and filed the underlying bug as known-issues #8 — it also makes `RecipeArticle`'s three
    section rules invisible on the live recipe page, which is pre-existing and deliberately not
    fixed here.
- **Left alone on purpose:** `PanelNav`'s `children` slot, which Review used to hang Save in and
  nothing passes now. The plan scopes that file to a doc note, so it is documented as the generic
  "extra control" slot rather than deleted. Delete it if no fourth panel ever wants it.
- **Verified:** `npm run lint`, `npx tsc --noEmit` and `npm run format:check` clean; `npm run build`
  succeeds (its `DYNAMIC_SERVER_USAGE` lines are the pre-existing ones logged in
  `admin-sidebar-shell/progress.md`). Then a headed Playwright pass at 1440×900, signed in through
  `scripts/dev-login.mjs`:
  - **the bar pins at 64px** — `barTop: 64` against `navBottom: 64` from `scrollY: 300` to the
    bottom of the page, `z-index: 30`, `elementFromPoint` inside the bar returning the bar, and
    `articleTop: -912` at full scroll: the article passes under it, not behind the navbar.
  - **`SAVES TO` swaps** — `/admin/preview/sticky-bar-proefrecept` ⇄
    `/recipes/sticky-bar-proefrecept` as the toggle moves, by click and by keyboard.
  - **the empty-value guard holds** — pressing the already-selected item leaves it selected
    (radix reports `""`, the guard eats it), and neither click nor <kbd>Enter</kbd> on a toggle item
    submits the form: `type="button"` confirmed on both items in the DOM, so that half of the trap
    really is imaginary.
  - **a taken title disables Save with the alert inside the sticky block** — retitled to
    `Appelmoes`, `isDisabled: true`, and the alert's `closest("[class*='lg:sticky']")` is the bar.
  - **a failed photo chips the bar and details in the flow** — forced by aborting
    `**/storage/v1/object/**`: `1 photo missing` inside the bar, the per-photo alert outside it,
    Save still enabled.
  - **Save still works end to end** — saved as a draft, redirected to
    `/admin/preview/sticky-bar-proefrecept`, exactly the address the bar had promised, and the saved
    page renders the article unchanged (the `align` deletion left the default path alone). The test
    recipe was deleted through `/admin/manage` and `select count(*) … where slug = …` returns 0. The
    only upload attempted was the one deliberately aborted, so the bucket gained nothing for the
    sweep to collect.
  - **`PreviewRail` re-measured, not eyeballed** — seven steps, `roomToStick: 652`, and in the
    pinned band (`scrollY` 400–1050) `railTop: 64` against `navBottom: 64`, `overlap: 0`, with
    "Live preview" at `y: 76`. It was `railTop: 24` / 40px of overlap before.
  - **also checked:** dark mode, and every width down to 420px. Below `lg` the bar is
    `position: static` and scrolls away as designed. The horizontal overflow at 420px is the
    desktop-first admin shell — all four panels measure `scrollWidth: 557` and `/admin/manage` is
    worse at 830 — so it is known-issues #6, not this change.
- **Next:** nothing outstanding in this plan. Both open questions the plan lists stayed open and
  neither bit: the caption's "written in one save" sat above a failed-photo alert during the test and
  read fine, and sub-1024px is `lg:sticky`'s problem by design.

## 2026-08-10 — plan recovered and written

- **Did:** wrote this folder. **No code yet** — nothing in the design has been implemented.
- **Why the date is a day late:** the design was finished on 2026-08-09 (`/brainstorm` →
  `/visualize` → `/grill-me` → `/write-plan`), but `/write-plan` stopped at its approval gate and the
  session ended before the nod came. It writes nothing before approval, so the whole design existed
  only in a transcript for a day. A following session was asked to "execute this plan", found no
  folder, and correctly refused to guess.
- **Recovered from** the session transcript plus the two surviving artefacts, both now in `assets/`:
  the four-tab prototype (which had been sitting in a temp scratchpad directory, not durable storage)
  and the `PreviewRail` overlap screenshot.
- **Verified while writing:** every code fact the plan cites still holds at `5ad371d` — `align` is
  still on `RecipeArticle` with `ReviewPanel` its only caller, `PreviewRail` is still `sticky top-6`,
  the navbar is still `sticky top-0 z-40 h-16`, `components/ui/toggle-group.tsx` exists, and
  `Stepper.tsx` still claims to be "the only place completeness is shown".
- **Next:** implement, in the three milestones the plan lists. Decision 9 (segmented control over the
  `Switch`) is flagged as proposed-not-chosen and is the first thing to revisit if the scope needs
  trimming.
