# Handoff: grilling the recipe detail overhaul

**State:** designed, nothing built. Plan at `7a0c262`, one revision at `2126fb1`. No code written.

**Your job is to attack this plan, not implement it.** It came out of a long visual brainstorm with
the owner, so the _taste_ calls are settled and evidenced. The _engineering_ calls are thinner, and
one is outright missing.

## Read, in this order

1. [plan.md](plan.md) — approach, components, risks, open questions.
2. [assets/recipe-detail-design.html](assets/recipe-detail-design.html) — open it. The mockup is the
   design; the anatomy below it carries the per-part numbers and tokens.
3. [decisions.md](decisions.md) — 15 decisions, each with what was rejected.

Then read `components/shared/RecipeArticle.tsx` **including its header comment**, and
`PreviewRail.tsx`. Both carry warnings this plan leans on.

## Don't re-litigate these

They were chosen against rendered alternatives, with the owner in the loop: title-before-photo (2),
one reading column (3), the welded stat bar (4), no orange card bars (5), one icon rule (6), filled
numerals with no connector (8), the floating pill (9), the untinted step note (15). Decision 10 —
keeping the square uncropped — upholds an existing repo invariant and is the least negotiable of all.

## The soft spots — start here

1. **The `PreviewRail` exclusion has no mechanism.** Decision 1 excludes the wizard's live rail from
   the redesign, but the rail renders the _same component_. Neither answer is chosen: a variant prop
   (one caller, forever) or a second component (the drift `PreviewRail`'s own comment calls "the
   drift problem in its purest form"). **Push hardest here.** Ask whether excluding the rail is worth
   a mechanism at all, given the owner's stated reason was that it "looks different anyway" — which
   is false, and they were told so.

2. **`placeholders` mode is unspecified, and it is the case that always happens.** The plan says
   `RecipeArticle` "keeps its `placeholders` prop" and says nothing more. But `ReviewPanel` renders
   `<RecipeArticle recipe={preview} placeholders />`, and **a draft being written has no cover, no
   times and no servings yet** — so the welded photo-plus-stat-bar has nothing to weld to _by
   construction_, inside the wizard, on every new recipe. Decision 12's "assume a cover exists" is
   true for published recipes and false here. Today's component reserves a dashed square in
   placeholder mode, and `admin-create-wizard` decision 21 says that reservation is what keeps
   `PreviewRail`'s scroll effect correct — remove it and `recipe.cover` has to join that effect's
   dependency array. **This is the gap most likely to be discovered mid-implementation.**

3. **Tickable ingredients is the only non-presentational thing in a presentation-only plan.** It
   forces a `"use client"` child, raises persistence questions, and produces clickable checkboxes
   inside the wizard preview where they mean nothing. Worth asking whether it belongs in this change
   or its own.

4. **The design was never validated against real data.** Of 7 rows: 1 has a cover, 4 have zero
   ingredients and zero steps, 1 has `servings = null`. The owner ruled these out as test data — fair,
   but that means **no live recipe has yet exercised this design**, and the `null` servings cell has
   no specified treatment.

5. **Deferred, but reachable today.** The theme toggle ships on every route, so dark mode is one click
   away and the band nearly vanishes there. The site is public, so phone visitors get a four-cell stat
   bar that does not fit at 390px. "Deferred" is a decision about effort, not about who sees it.

6. **Small inconsistency.** Ingredients get a live "2 of 6"; Method gets a static "3 steps". Two
   different kinds of count in matching card headers.

## Open by design

Rail mechanism · whether ticks persist to `localStorage` · whether the counts stay. All four questions
are at the foot of [plan.md](plan.md).

## When done

If grilling changes a decision, revise it in `decisions.md` in the same commit rather than leaving
the record silently false — that is the convention across `docs/plans/`. New decisions append; never
renumber.
