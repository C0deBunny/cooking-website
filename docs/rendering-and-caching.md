# Rendering & caching

Why this project is full of `Suspense` boundaries, and how cache invalidation works. Everything here
follows from one line in `next.config.ts`:

```ts
cacheComponents: true;
```

Companion to [permission-model.md](permission-model.md) (which explains why the `/admin` gate is not
the real security boundary).

## `"use cache"` and cache lifetimes

Cached data functions use `"use cache"` plus `cacheTag(...)` — see `lib/recipes/queries.ts`.

Without an explicit `cacheLife`, entries use the `"default"` profile: **stale 5m, revalidate 15m, no
expiry**. `npm run build` prints the window per route, so a route showing `Revalidate 15m` is cached.
That build output is the quickest way to confirm caching is actually on for a route rather than
assuming it from the source.

A cached function may not read cookies, which is why `lib/recipes/queries.ts` uses
`lib/supabase/public-client.ts` rather than the cookie-backed server client.

## Invalidating from a mutation — Next 16 split the API

Picking the wrong one of these is silent: the page just serves stale data.

- **`updateTag("recipes")` — server actions only, read-your-own-writes.** The value is fresh on the
  same response, so a form submitter sees their own change. This is what you want for nearly every
  mutation in this project. `lib/recipes/actions.ts` calls it after `save_recipe` returns; follow
  that.
- **`revalidateTag("recipes", profile)` — marks entries stale for a later background refresh.** The
  second argument is **required** in Next 16, and it does not guarantee freshness on the next read.
  For webhooks and external syncs, not form submissions.
- **`revalidatePath("/admin/manage")` — refreshes one route's entry in the client router cache.**
  Needed for pages that are _uncached_, so no tag covers them. `togglePublished` calls it **alongside**
  `updateTag` and both are load-bearing: `updateTag` kills the cached public reads, without which a
  freshly published recipe stays missing from `/recipes` for the revalidate window, while
  `revalidatePath` is what stops the manage-page row re-rendering its pre-click state.

A tag and a path are not alternatives — a mutation that changes both a cached read and an uncached
admin view needs both calls. See `lib/recipes/actions.ts:127`.

## Request data fails the build, it doesn't merely degrade

Under `cacheComponents`, reading request data in something that would otherwise be prerendered is a
**build error** (`StaticGenBailoutError`), not a slow path. All four of these were hit while building
the recipe pages:

| What                                         | Where it bit                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Cookie reads                                 | a bare `await requireUser()` at the top of `app/admin/layout.tsx`                                        |
| `await params` in a page body                | `app/recipes/[slug]/page.tsx` — deliberately **not** `async`; it passes the promise to a Suspended child |
| A server action bound to `<form action={…}>` | `app/admin/create/page.tsx`                                                                              |
| `usePathname()` in a client component        | `AdminSidebar`                                                                                           |

Two of those are worth expanding, because the cause is not where the symptom is:

- **The create page's boundary has to wrap the whole wizard**, even though the `<form>` is four
  levels down in the Review panel. `useActionState` is called at the wizard's root, where the draft
  lives, so the action is referenced as soon as anything renders.
- **`usePathname()` is harmless on a static route and request data on a dynamic one.**
  `AdminSidebar` only became a build blocker once `/admin` gained its first `[slug]` child — so a
  component that has always been fine can start failing because a _sibling route_ was added.

**There is no route-level escape hatch.** `export const dynamic = "force-dynamic"` is rejected
outright with "not compatible with `nextConfig.cacheComponents`". `Suspense` is the mechanism.

When a build fails this way, `next build --debug-prerender` names the component and line; the default
trace usually doesn't.

## The `/admin` prerender trade-off

`app/admin/layout.tsx` renders `_components/AdminGate.tsx` — a `requireUser()` side-effect component
that returns `null` — inside `Suspense`. That keeps the build green, and the cost was accepted
deliberately:

`/admin` stays partially prerendered, so its shell is flushed before the gate resolves, and the
redirect arrives as a client-side `replace` to `/`. **An anonymous visitor sees admin chrome for a
moment.** Nothing in that shell is private — it is the sidebar rail and a placeholder card — but it
means you should not describe `/admin` as hard-gated.

To harden it: opt the route out of prerendering so the gate blocks and nothing ships until the user
is known. The only real loss is the static shell.
