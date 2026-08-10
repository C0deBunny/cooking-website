# Handoff: implementing the review & publish revamp

**State:** planned, nothing built. Plan committed at `3b614b7`; no code has been written.

## Read this first, in this order

1. [plan.md](plan.md) — the design, the files, the milestones, the verification list.
2. [decisions.md](decisions.md) — nine decisions with their alternatives.
3. [assets/review-panel-options.html](assets/review-panel-options.html) — open it. Tabs
   <kbd>1</kbd>–<kbd>4</kbd> are Today / A / B / C; <kbd>A</kbd> toggles annotations. **A is what
   you are building.**

**Do not re-derive the design.** Four of the nine decisions exist because a first proposal was
falsified — each record says which one and why. Reopening them without reading them costs the same
mistakes again.

## Order of work

| #   | Scope                                                                       | Notes                       |
| --- | --------------------------------------------------------------------------- | --------------------------- |
| 1   | `ReviewPanel.tsx` — sticky bar, `SAVES TO`, toggle, Save, slug alert inside | the real work               |
| 2   | preview surface: caption, `bg-background`, centred; delete `align`          | can't sensibly split from 1 |
| 3   | `PreviewRail.tsx` `top-6` → `top-16`, `PanelNav.tsx` doc note               | independent, either side    |

1 and 2 are one commit's worth — deleting the checklist is what frees `align`, so splitting them
leaves a dead prop in the tree between commits.

## What will bite

- **`ReviewPanel` must remain the wizard's only `<form>`**, and the form still wraps only the toggle,
  the hidden payload and Save. Steps 1–3 have no form element on purpose — see `CLAUDE.md`, "The
  recipe wizard". Do not wrap the sticky bar in a second one.
- **The `ToggleGroup` needs an empty-value guard** — radix `type="single"` permits deselection.
  `onValueChange={(v) => v && onPatch({ published: v === "publish" })}`. It does **not** need a
  submit guard; radix already sets `type="button"`. Decision 9.
- **`top-16` / `z-30` are not arbitrary.** The navbar is `sticky top-0 z-40 h-16` on every route and
  its comment says _"Change it and grep top-16."_ The bar goes under it in z and clear of it in
  offset.
- **Deleting `align` is safe and verified.** `RecipeArticle` has four call sites; only
  `ReviewPanel:187` passes the prop, and the other three already take the `"center"` default. Delete
  the prop _and_ its doc paragraph. The public recipe page must render byte-identically — that is
  what keeps `admin-create-wizard` decisions 7/15/20 intact.
- **Don't touch `RecipeArticle` beyond that deletion.** The square column-width hero stays for
  everyone. Decision 1.
- **Leave the `/admin/create` Suspense boundary alone.** It wraps the whole wizard for two reasons,
  one of them non-obvious: `crypto.randomUUID()` in `draft.ts` aborts a prerender without a Suspense
  frame above it. `cacheComponents` is on and there is no route-level escape hatch.
- **The failed-photo alert's `backToPhoto` logic survives verbatim.** Its label and destination are
  derived together because a fixed label was wrong half the time. Move it; don't rewrite it.

## Verifying

`npm run lint` and `npx tsc --noEmit` must be clean — **there is no test suite**, so the browser pass
is the real check. Run `npm run build` too; this touches a page under `cacheComponents`.

Then drive it headed via Playwright MCP, signed in with `scripts/dev-login.mjs` (run it by
_filename_ — never paste its body or print what it reads). The full checklist is in plan.md under
**Verification**; the ones most likely to fail:

- the bar pins at 64px and the article scrolls _under_ it, not behind the navbar;
- `SAVES TO` swaps between `/recipes/…` and `/admin/preview/…` with the toggle;
- a taken title disables Save with the collision alert still on screen;
- `PreviewRail` needs **about seven steps** before it sticks at all — on a short draft
  `roomToStick` is 0, so a two-step recipe proves nothing. Re-measure `railTop` against
  `navBottom` rather than eyeballing it.

Clean up any test upload through the field's own ✕, so the orphan sweep has nothing to collect.

## One call left open

**Decision 9** — the segmented `Draft ▏Publish` replacing the `Switch` — was proposed, not chosen.
It is the first thing to drop if scope needs trimming, and nothing else in the design depends on it:
the swapping `SAVES TO` line works with a `Switch` just as well.

## When done

Append to [progress.md](progress.md) with the sha, per the template at the top of that file. If you
depart from a decision, revise it in `decisions.md` in the same commit rather than leaving the
record silently false — that is the convention the rest of `docs/plans/` follows.
