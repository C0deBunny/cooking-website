# Permission model

How access is decided in this project, and what would have to change if personal accounts are ever
added. Companion to [schema-current.html](schema-current.html) (the schema it is enforced in) and
[known-issues.md](known-issues.md).

## There are two roles, not three

**Visitor** (`anon`) and **admin** (`authenticated`). There is no normal user account — every account
that can log in is an admin, deliberately.

|                             | read published recipes | read drafts | create / edit / delete |
| --------------------------- | ---------------------- | ----------- | ---------------------- |
| **visitor** — `anon`        | yes                    | no          | no                     |
| **admin** — `authenticated` | yes                    | yes         | yes, any recipe        |

That applies to all four tables. A visitor may read the steps, ingredients and images of a published
recipe; for an unpublished one, the child rows are hidden too, because each child policy tests the
parent's `published` flag rather than trusting that the parent was hidden.

## Why the policies look permissive

Every write policy is `using (true) with check (true)`, and no table has a `user_id`. Both are
correct for this model:

- Any admin may edit any recipe, so there is no per-row condition to test. `using (true)` is the
  honest expression of that, not a placeholder.
- Recipes are not owned by an account, so there is no ownership fact for a policy to check. Adding
  `user_id` would add a column nothing reads and no policy consults.

**Don't "fix" this by pinning `auth.uid()` or adding an owner column.** It reads like a missing
restriction and isn't one. If the model changes, see the rebuild section below — the change is bigger
than tightening these policies.

## Two layers, both must allow it

Table-level `grant`s are checked separately from RLS policies, and an operation needs both:

```
grant select                 on <all four> to anon, authenticated;
grant insert, update, delete on <all four> to authenticated;
```

So an anonymous write is refused twice over — no grant, and no policy. The migration sets grants
explicitly rather than relying on the project's default privileges, so a change to those defaults
can't silently widen access.

## What the app-level checks are, and aren't

- `requireUser()` in every **mutating** server action, and `AdminGate` for `/admin` pages, are **UX
  and defence-in-depth**. They keep a logged-out visitor out of the admin UI. `checkSlugTaken` is the
  one action that skips it on purpose — it fires on a keystroke, and `requireUser()` redirects. It
  calls `getCurrentUser()` instead and returns only a boolean, so RLS covers what it reads.
- **RLS is the real boundary.** The publishable key ships to every visitor's browser, so anyone can
  call the Supabase API directly as `anon` without going through the app at all. Nothing in
  `app/` is in the request path for that.

Concretely: `lib/recipes/queries.ts` runs `select("*")` with no `published` filter and still returns
only published recipes to visitors, because the database filters them. Keep new reads honest about
that — the filtering is a policy, not a `where` clause you can forget to write.

## Account creation is the only admission control

Because every account is an admin, there is nothing between "has an account" and "can delete every
recipe." So:

- **Public signups must stay disabled in Supabase Auth.** Accounts are created by hand in the
  dashboard.
- Anyone who obtains an account obtains full write access. That is the intended grant, not a hole.
- Enabling signups would hand write access to anyone who registers. Nothing would error, no test
  would fail, and no warning would appear — the policies would keep doing exactly what they say.

This is the one invariant in the project that lives in a dashboard setting rather than in code, which
is precisely why it is written down here.

## If personal accounts are ever added, this needs a partial rebuild

The moment a non-admin can log in, `authenticated` stops meaning "admin" — and every write policy is
written against `authenticated`. So each `to authenticated ... using (true)` policy becomes wrong at
exactly that moment, not gradually. Plan on rebuilding these pieces:

**1. A way to tell an admin from a normal user.** The policies need something to test. Options,
roughly cheapest first:

- A claim in the user's `app_metadata`, read in policies via `auth.jwt()`. No extra table.
- An `admins` table (just `user_id`), with policies testing `exists (select 1 from admins …)`.
  Easy to reason about and to grant/revoke; costs a subquery per policy check.
- A `profiles` table with a `role` column, if profiles are wanted anyway for display names.

> **Trap worth naming now:** gate on `app_metadata`, never on `user_metadata`. A user can edit their
> own `user_metadata` through the client SDK, so a policy trusting it lets anyone promote themselves
> to admin. `app_metadata` is writable only with the service-role key.

**2. Rewrite the four write policies** to test admin-ness instead of mere authentication, and split
the "reads everything including drafts" policy the same way — a normal user should see drafts no more
than a visitor does.

**3. Decide whether recipes become owned**, which depends on what personal accounts are actually for:

- If it means _other people write their own recipes_, then `recipes` gains
  `user_id uuid references auth.users(id)`, and write policies become
  `using (user_id = auth.uid() or is_admin())`. The three child tables reach ownership through their
  parent rather than carrying their own copy.
- If it means _accounts for saving favourites, comments or shopping lists_, recipes stay unowned and
  the new concepts get their own tables — those are the ones that get `user_id` and per-user policies.

These are very different amounts of work; settle which one is meant before touching the schema.

**4. Tighten the app-level checks too.** `requireUser()` only asks "is anyone logged in." It would
need an admin variant, and `AdminGate` would need to use it — otherwise normal users reach the admin
UI and merely get empty results from RLS, which is a confusing way to be denied.

**5. Extend it to Storage**, which is a separate policy system and currently has nothing. See
[image-storage.md](image-storage.md).

**Order matters:** do all of the above _before_ enabling signups, not after. The window between
"signups on" and "policies tightened" is a window where anyone can register and delete every recipe.
