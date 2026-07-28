// import lib
import { requireUser } from "@/lib/auth/queries";

/**
 * Server-side gate for /admin. Renders nothing — it exists for its side effect: requireUser()
 * sends anonymous visitors home instead of letting them sit on the admin UI.
 *
 * It must stay inside a Suspense boundary. `cacheComponents` is on, and a cookie read that
 * blocks the root shell fails the build with StaticGenBailoutError, so this is what keeps
 * /admin partially prerendered. The trade: the static shell is flushed before the gate
 * resolves, so the redirect reaches an anonymous visitor as a client-side navigation and they
 * briefly see the admin chrome. Nothing in that shell is private — the recipe list is the same
 * one /recipes shows — and the write is separately guarded by requireUser() in createRecipe.
 */
export default async function AdminGate() {
  await requireUser();

  return null;
}
