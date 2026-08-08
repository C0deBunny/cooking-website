---
name: review-branch
description: Reviews the current branch against its merge-base as a pre-merge PR review. Fans out read-only band agents — invariants, correctness, structure, caching, hygiene, plus data and ux when the diff touches them — then dedups their findings into one severity-grouped list ending in a merge verdict. Use before merging a feature branch. Do not use to apply fixes; it never modifies the tree.
argument-hint: "[base ref — defaults to main]"
---

A pre-merge review of the current branch, fanned out across band agents that each own one concern.

**This skill never modifies the working tree.** Not the branch, not the files, not the index. If a
finding deserves a fix, report it and stop — the user decides whether to apply it, and `/code-review
--fix` or `/simplify` are the tools that do so.

## Step 1: Resolve the base

1. `git rev-parse --abbrev-ref HEAD` — if it is `main`, stop and say there is nothing to review.
2. `git merge-base <base> HEAD`, where `<base>` is the argument or `main`. Call the result `BASE`.
3. If `BASE` equals `HEAD`, stop — the branch has no commits of its own.
4. Do not `git fetch`. Reviewing against the local `main` is the intended behaviour; if it is stale,
   say so in the verdict rather than touching the network.

## Step 2: Build the change set

1. `git diff --stat BASE...HEAD` for the shape of the branch.
2. `git diff --name-only BASE...HEAD` for the file list every band works from.
3. `git log --oneline BASE..HEAD` for intent — what the branch was _trying_ to do is what the review
   measures it against.

Use the three-dot form for diffs. Two-dot attributes `main`'s own newer commits to this branch.

## Step 3: Pre-flight the deterministic checks

Run `npm run lint` and `npx tsc --noEmit`. Both are allowlisted, both are cheap, and both state
facts no agent should be spending tokens re-deriving. Their output feeds the verdict verbatim.

A failure here does not abort the review — the bands still have things to say — but it is
automatically a **blocking** item.

## Step 4: Pick the conditional bands

Always dispatch: `review-invariants`, `review-correctness`, `review-structure`, `review-caching`,
`review-hygiene`.

From the changed-file list, additionally dispatch:

- `review-data` — if any of `supabase/`, `types/database.ts`, `types/recipes.ts`, `*.sql`, or
  `docs/schema-current.html` moved.
- `review-ux` — if any `*.tsx` or `app/globals.css` moved.

A band that has nothing to look at is not free: it pads its findings to justify the run. Leave it out.

## Step 5: Dispatch every band in one message

Spawn all selected bands as concurrent `Agent` calls **in a single message**. Give each the same
briefing:

- `BASE` and `HEAD` shas, so it can run its own `git diff BASE...HEAD -- <file>`
- the full changed-file list
- the commit subjects from Step 2, as the branch's stated intent
- this instruction, verbatim: **read the whole file, not just the hunk.** A reviewer that sees only
  the diff cannot tell that a write-back is async, that a helper already exists two files over, or
  that the invariant being broken is stated at the top of the file.

Each band's charter lives in its own agent definition. Do not restate it in the prompt.

## Step 6: Merge and dedup

1. Collect every band's findings.
2. Dedup on file + line + claim. Bands overlap deliberately — invariants and caching both care about
   `updateTag`, structure and correctness both notice dead code. Three bands noticing one defect is
   one finding, and the merged entry names all the bands that raised it.
3. Drop any finding that lacks a concrete failure scenario. No exceptions — that rule is the only
   thing standing between this skill and a wall of "consider extracting this".
4. Drop findings about code the branch did not touch, **unless** the finding is an omission (see
   below). Pre-existing debt is not this review's business.
5. Sort by severity, then by file.

## Step 7: Report

Print the findings inline, grouped by severity, then the verdict. Nothing is written to disk.

Each finding renders as:

```
**<claim in one sentence>** — [file.ts:42](path/to/file.ts#L42) · _band, band_
<failure scenario: concrete inputs or state → the wrong outcome>
```

`file:line` is optional, because the highest-value findings here are **omissions** and omissions have
no line: a schema change with no migration, a write action with no `updateTag("recipes")`, a new
mutating action with no `requireUser()`, a rule changed in code but not in `CLAUDE.md`. Report those
against the file that should have contained the missing thing, or against the branch as a whole.

**Severity ladder**

- **blocking** — breaks the build, fails lint or typecheck, corrupts or orphans data, violates an
  invariant documented in `CLAUDE.md` or `docs/`, or opens a write path.
- **should-fix** — a real defect the branch can survive but shouldn't ship with.
- **nit** — taste, naming, formatting. Cap this section at five; the rest are noise.

**Verdict** — one line, last:

- `SHIP` — nothing blocking, nothing should-fix.
- `FIX FIRST` — no blockers, but named should-fix items.
- `BLOCKED` — blocking items, each named.

## Error Handling

- **Detached HEAD or no `main`:** ask for an explicit base ref rather than guessing.
- **A band returns nothing:** report it as a band that found nothing, not as a band that passed.
  Silence and a clean bill of health are different results.
- **A band proposes an edit:** discard the edit, keep the finding. The bands are read-only by
  charter; a band that forgot is a band whose output needs trimming, not obeying.
- **Huge diff (hundreds of files):** say so, review the changed source files, and state plainly which
  paths you skipped. A silent cap reads as coverage that never happened.
