# Progress: Review & publish revamp

<!-- Living log. Append newest entries at the top:
     ## YYYY-MM-DD
     - Did: <what changed> (<sha>)
     - Verified: <how>
     - Next: <what remains> / Blocked: <on what>
-->

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
